const {
  base_url_azure,
  customAxiosTfs,
  customAxiosAzure,
  base_url_tfs,
} = require("./constantes");
const { getRepositoriosGit } = require("./getInfoProjetos");
const jsonModelBodyRelease = require("./ApiModels/modelBodyReleaseDefinitionCoreCreate.json");

async function getReleaseDefinitions(projetoId) {
  const response = await customAxiosTfs.get(
    `${base_url_tfs}/${projetoId}/_apis/release/definitions?api-version=3.2-preview`
  );
  const releaseList = response.data.value;
  const releaseDefinitions = releaseList.map(async (item) => {
    const response = await customAxiosTfs.get(
      `${base_url_tfs}/${projetoId}/_apis/release/definitions/${item.id}`
    );
    const releaseDefinition = response.data;
    return releaseDefinition;
  });

  return releaseDefinitions;
}

async function getBuildProjetoByAliasArtefato(nomeProjeto) {
  let response = null;
  try {
    response = await customAxiosAzure.get(
      `${base_url_azure}/${nomeProjeto}/_apis/build/definitions?api-version=6.0`
    );
  } catch (error) {
    console.log(error.response.data);
    return null;
  }

  const buildList = response.data.value;
  const buildListaTratada = buildList.map((build) => {
    const {
      name,
      id,
      project: { id: idProjeto, name: nomeProjeto },
    } = build;
    return {
      nome: name,
      id,
      idProjeto,
      nomeProjeto,
    };
  });
  return buildListaTratada;
}

function adicionaArtefatosNaRelease(
  novaRelease,
  release,
  buildListDefinitions
) {
  novaRelease.artifacts = release.artifacts.map((artefact) => {
    const build = buildListDefinitions.find((b) =>
      artefact.alias.includes(b.nome)
    );

    if (!build) {
      console.log(
        "Não foi encontrado o build para o artefato: " +
          artefact.alias.toUpperCase()
      );
      return artefact;
    }

    const novoArtefact = {
      ...artefact,
      sourceId: `${build.idProjeto}:${build.id}`,
      isRetained: false,
      alias: "_" + build.nome.split(/\s/g).join(""),
      definitionReference: {
        ...artefact.definitionReference,
        definition: {
          id: build.id,
          name: build.nome, // NOME ALIAS BUILD ARTIFACT
        },
        project: {
          id: build.idProjeto,
          name: build.nomeProjeto,
        },
      },
    };
    return novoArtefact;
  });
  return { ...novaRelease };
}

function adicionaTriggers(novaRelease) {
  const artefact = novaRelease.artifacts.find((a) => a.isPrimary);

  novaRelease.triggers = [{ artifactAlias: artefact.alias, triggerType: 1 }];

  return { ...novaRelease };
}

function adicionaEnvironments(novaRelease, release, queueId) {
  novaRelease.environments = release.environments.map((env) => ({
    ...env,
    badgeUrl: "",
    deployPhases: env.deployPhases.map((deployPhase) => ({
      ...deployPhase,
      deploymentInput: {
        ...deployPhase.deploymentInput,
        queueId,
      },
    })),
  }));

  return { ...novaRelease };
}

function createModeloReleaseParaAzure(release, buildListDefinitions, queueId) {
  let novaRelease = { ...jsonModelBodyRelease };
  console.log("Release antiga TFS sendo criada: " + release.name);

  novaRelease.name = release.name;

  novaRelease = adicionaArtefatosNaRelease(
    novaRelease,
    release,
    buildListDefinitions
  );

  novaRelease = adicionaTriggers(novaRelease, buildListDefinitions);

  novaRelease = adicionaEnvironments(novaRelease, release, queueId);

  return novaRelease;
}

async function getQueueId(nomeProjeto) {
  const response = await customAxiosAzure.get(
    `${base_url_azure}/${nomeProjeto}/_apis/distributedtask/queues?api-version=6.0-preview`
  );
  const queueList = response.data.value;
  const defaultQueue = queueList.filter((queue) => queue.name === "Default");
  return defaultQueue.id;
}

async function createReleaseDefinitions(
  releases,
  buildListDefinitions,
  nomeProjeto
) {
  const releasesAlteradas = releases.map(async (releasePromise) => {
    const release = await releasePromise;
    const queueId = getQueueId(nomeProjeto);
    const releaseAlterada = createModeloReleaseParaAzure(
      release,
      buildListDefinitions,
      queueId
    );
    try {
      const response = await customAxiosAzure.post(
        `${base_url_azure}/${nomeProjeto}/_apis/release/definitions?api-version=6.0-preview`,
        releaseAlterada
      );
      console.log(
        "Release criada com sucesso, definação release: " + response.data.name
      );
      return response.data;
    } catch (error) {
      console.log(error.response.data);
      return null;
    }
  });

  return releasesAlteradas;
}

async function createRelease(nomeProjeto, release) {
  const { artifacts, id } = release;

  const jsonModelBodyCreateRelease = {
    definitionId: id,
    isDraft: false,
    description: "",
    manualEnvironments: [],
    artifacts: [
      {
        alias: artifacts[0].alias,
        instanceReference: {
          id: artifacts[0].definitionReference.definition.id,
          definitionId: id,
          definitionName: artifacts[0].definitionReference.definition.name,
        },
      },
    ],
    variables: {},
    environmentsMetadata: [
      { definitionEnvironmentId: 53, variables: {} },
      { definitionEnvironmentId: 54, variables: {} },
      { definitionEnvironmentId: 55, variables: {} },
    ],
    properties: { ReleaseCreationSource: "ReleaseHub" },
  };

  try {
    const response = await customAxiosAzure.post(
      `${base_url_azure}/${nomeProjeto}/_apis/release/releases?api-version=6.0-preview`,
      jsonModelBodyCreateRelease
    );
    console.log("Release criada com sucesso, release: " + response.data.name);
  } catch (error) {
    console.log("Não foi possível criar a release");
    console.error(error.response.data);
  }
}

async function getReleasesCriadas(nomeProjeto) {
  const response = await customAxiosAzure.get(
    `${base_url_azure}/${nomeProjeto}/_apis/release/definitions?api-version=6.0-preview`
  );
  const listaReleases = response.data.value;

  const listaCompletaReleases = listaReleases.map(async (release) => {
    const response = await customAxiosAzure.get(
      `${base_url_azure}/${nomeProjeto}/_apis/release/definitions/${release.id}?api-version=6.0-preview`
    );
    return response.data;
  });

  return listaCompletaReleases;
}

async function MigracaoReleases(nomeProjetoTFS) {
  const repositoriosGit = await getRepositoriosGit(nomeProjetoTFS);

  const releaseDefinitions = await getReleaseDefinitions(
    repositoriosGit[0].idProjeto
  );

  const buildListDefinitions = await getBuildProjetoByAliasArtefato(
    repositoriosGit[0].nomeProjeto
  );

  if (!buildListDefinitions) return;

  await createReleaseDefinitions(
    releaseDefinitions,
    buildListDefinitions,
    repositoriosGit[0].nomeProjeto
  );

  const releasesCriadas = await getReleasesCriadas(
    repositoriosGit[0].nomeProjeto
  );

  releasesCriadas.forEach(async (releasePromise) => {
    const release = await releasePromise;
    if (release) {
      console.log(
        `Release definition criada ${release.name} criada com sucesso`
      );
      console.log(`Criando release ${release.name}`);
    } else console.log(`Release não foi criada/migrada`);
  });
}

module.exports = {
  MigracaoReleases,
};
