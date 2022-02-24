#!/usr/bin/env node
require("dotenv").config();

const argv = require("yargs/yargs")(process.argv.slice(2)).argv;
const { spawn } = require("child_process");
const jsonModelEndpointSsh = require("./ApiModels/modelbodyEndpointCreateSsh.json");
const jsonModelEndpointSonar = require("./ApiModels/modelBodyEndpointCreateSonar.json");
const jsonModelEndpointNuget = require("./ApiModels/jsonModelEndpointNuget.json");
const { MigracaoReleases } = require("./release");

const {
  listaServicosConexoesSsh,
  customAxiosTfs,
  customAxiosAzure,
  listaServicosNuget,
  base_url_tfs,
  base_url_azure,
  TOKEN_AZURE_BASE_64,
} = require("./constantes");

const {
  getRepositoriosGit,
  getProjetoCriadoNoAzure,
  getInfoStfvc,
} = require("./getInfoProjetos");

function criaUrlAzureGit(nomeProjeto, nomeRepositorio) {
  return base_url_azure + nomeProjeto + "/_git/" + nomeRepositorio;
}

async function startMigracaoRepositorios() {
  if (argv.repositorioTfvc) await MigracaoRepoTfvc(argv.nomeProjetoTfs);
  else await MigracaoRepo(argv.nomeProjetoTfs);
}

async function startMigracaoBuild() {
  await MigracaoBuild(argv.nomeProjetoTfs);
}

async function startMigracaoReleases() {
  await MigracaoReleases(argv.nomeProjetoTfs);
}

function InicializarProjetoExistente(
  uuiddProjeto,
  nomeRepositorio,
  nomeProjeto,
  gitUrl,
  pularCriacaoRepositorio
) {
  console.log(
    "Inicializando repositorio e migrando projeto existente: " +
      uuiddProjeto +
      " " +
      nomeRepositorio +
      " " +
      nomeProjeto +
      " " +
      gitUrl +
      " " +
      pularCriacaoRepositorio
  );
  let shellComand = `.\\InicializaçãoProjetoExistente.ps1 -UuiddProjeto ${uuiddProjeto} -NomeRepositorio ${nomeRepositorio} -NomeProjeto ${nomeProjeto} -GitUrl ${gitUrl} -BaseAzureUrl ${base_url_azure} -TokenAzure ${TOKEN_AZURE_BASE_64}`;

  if (pularCriacaoRepositorio) {
    shellComand = shellComand + " -PularCriacaoRepositorio";
  }

  const ls = spawn("powershell.exe", [shellComand]);

  ls.stdout.on("data", (data) => {
    console.log(`Output do processo de criação do projeto: ${data}`);
  });

  ls.stderr.on("data", (data) => {
    console.error(`Erros processo: ${data}`);
    ls.kill();
  });

  ls.on("close", (code) => {
    console.log(`Processo terminou com o código: ${code}`);
  });
}

function InicializaScriptParaMigracaoRepoTfvcParaGit(nomeProjeto) {
  console.log(
    "Inicializando repositorio e migrando projeto existente: " + nomeProjeto
  );
  let shellComand = `.\\MigraRepositorioTfsParaGitAzure.ps1 -NomeProjeto ${nomeProjeto} -BaseAzureUrl ${base_url_azure} -BaseTfsUrl ${base_url_tfs}`;

  const ls = spawn("powershell.exe", [shellComand]);

  ls.stdout.on("data", (data) => {
    console.log(`Output do processo de criação do projeto: ${data}`);
  });

  ls.stderr.on("data", (data) => {
    console.error(`Erros processo: ${data}`);
    ls.kill();
  });

  ls.on("close", (code) => {
    console.log(`Processo terminou com o código: ${code}`);
  });
}

async function getBuildDefinitionsTfs(idProjeto) {
  const response = await customAxiosTfs.get(
    `${base_url_tfs}/${idProjeto}/_apis/build/definitions?api-version=3.2-preview&type=build`
  );
  const buildIdList = response.data.value;
  const buildDefinitions = buildIdList.map(async (item) => {
    const response = await customAxiosTfs.get(
      `${base_url_tfs}/${idProjeto}/_apis/build/Definitions/${item.id}`
    );
    const buildDefinition = response.data;
    return buildDefinition;
  });

  return buildDefinitions;
}

async function createProjetoAzure(nomeProjeto, descricaoProjeto) {
  const response = await customAxiosAzure.post(
    `${base_url_azure}/_apis/projects?api-version=6.0-preview`,
    {
      name: nomeProjeto,
      description: descricaoProjeto,
      visibility: 0,
      capabilities: {
        versioncontrol: {
          sourceControlType: "Git",
        },
        processTemplate: {
          templateTypeId: "8604b8a0-2607-420f-8e6f-67ade6a125f0",
        },
      },
    }
  );
  console.log(
    "Operação para criar repositório no Azure inicializada com sucesso, operação id: " +
      response.data.id
  );
  const referenciaOperacao = response.data;
  return referenciaOperacao;
}

async function getOperationAzure(idOperacao) {
  const response = await customAxiosAzure.get(
    `${base_url_azure}/_apis/operations/${idOperacao}?api-version=6.0-preview`
  );
  return response.data;
}

async function esperaProjetoSerCriado(referenciaOperacao) {
  const { status, id } = referenciaOperacao;
  let statusRecuperado = status;
  while (statusRecuperado !== "succeeded") {
    if (statusRecuperado === "failed" || statusRecuperado === "cancelled")
      throw new Error("Falha ao criar projeto" + statusRecuperado);
    const operation = await getOperationAzure(id);
    statusRecuperado = operation.status;
  }
  return statusRecuperado;
}

function setNomeChaveIdProjeto(
  modelo,
  nomeConexaoServico,
  idProjeto,
  nomeProjeto
) {
  modelo.serviceEndpointProjectReferences[0].name = nomeConexaoServico;
  modelo.serviceEndpointProjectReferences[0].projectReference.id = idProjeto;
  modelo.serviceEndpointProjectReferences[0].projectReference.name =
    nomeProjeto;
  modelo.name = nomeConexaoServico;
  return modelo;
}

function setHostSsh(modeloSsh, host) {
  modeloSsh.data.Host = host;
  return modeloSsh;
}

async function createConexaoComServico(modeloAlterado) {
  const response = await customAxiosAzure.post(
    `${base_url_azure}/_apis/serviceendpoint/endpoints?api-version=6.0-preview`,
    modeloAlterado
  );
  console.log("Conexão com o serviço criado: " + response.data.name);
  return response.data;
}

function setModeloNuget(modeloNuget, servico, idProjeto, nomeProjeto) {
  let modeloNugetAlterado = setNomeChaveIdProjeto(
    modeloNuget,
    servico.nome,
    idProjeto,
    nomeProjeto
  );

  modeloNugetAlterado.url = servico.url;

  return modeloNugetAlterado;
}

async function criaConexoesComServicos(nomeProjeto, idProjeto) {
  const modelo = { ...jsonModelEndpointSsh };
  const modeloSonar = { ...jsonModelEndpointSonar };
  const modeloNuget = { ...jsonModelEndpointNuget };
  const listaServicos = [];

  listaServicosConexoesSsh.forEach(async (servico) => {
    let modeloAlterado = setHostSsh(modelo, servico.host);
    modeloAlterado = setNomeChaveIdProjeto(
      modeloAlterado,
      servico.nome,
      idProjeto,
      nomeProjeto
    );
    listaServicos.push(await createConexaoComServico(modeloAlterado));
  });

  let modeloSonarAlterado = setNomeChaveIdProjeto(
    modeloSonar,
    "Sonar",
    idProjeto,
    nomeProjeto
  );

  listaServicos.push(await createConexaoComServico(modeloSonarAlterado));

  listaServicosNuget.forEach(async (servico) => {
    let modeloAlterado = setModeloNuget(
      modeloNuget,
      servico,
      idProjeto,
      nomeProjeto
    );
    listaServicos.push(await createConexaoComServico(modeloAlterado));
  });

  return listaServicos;
}

function migracaoProjetoTfvc(projetoCriado) {
  InicializaScriptParaMigracaoRepoTfvcParaGit(projetoCriado.name);
}

function migracaoRepositoriosParaAzure(repositorios, projetoCriado) {
  repositorios.forEach((repositorio) => {
    InicializarProjetoExistente(
      projetoCriado.id,
      repositorio.nomeRepositorio,
      projetoCriado.name,
      repositorio.gitUrl,
      repositorio.nomeRepositorio === projetoCriado.name
    );
  });
}

function setSonarQubeServiceId(phase, sonaQubeServiceId) {
  const newPhase = { ...phase };
  const taskSonarQubeId = "15b84ca1-b62f-4a2a-a403-89b77a063157";
  newPhase.steps = phase.steps.map((step) => {
    if (step.task.id !== taskSonarQubeId) {
      return step;
    }

    return {
      ...step,
      inputs: {
        ...step.inputs,
        SonarQube: sonaQubeServiceId,
      },
    };
  });

  return newPhase;
}

function setNugetServiceId(phase, servicosNugetsIds) {
  const newPhase = { ...phase };
  const taskNugetId = "333b11bd-d341-40d9-afcf-b32d5ce6f23b";
  newPhase.steps = phase.steps.map((step) => {
    if (step.task.id !== taskNugetId) {
      return step;
    }

    return {
      ...step,
      inputs: {
        ...step.inputs,
        externalEndpoints: servicosNugetsIds,
      },
    };
  });

  return newPhase;
}

function getNovaBuildDefinitionsAzure(
  buildDefinition,
  projetoCriado,
  repositoriosMigrados,
  queueProjetoAzure,
  { sonaQubeServiceId, servicosNugetsIds }
) {
  const buildDefinitionAlterada = { ...buildDefinition };
  buildDefinitionAlterada.project = {
    ...buildDefinition.project,
    id: projetoCriado.id,
    name: projetoCriado.name,
    url: projetoCriado.url,
  };
  buildDefinitionAlterada.process.phases = buildDefinition.process.phases.map(
    (phase) => {
      let newPhase = setSonarQubeServiceId(phase, sonaQubeServiceId);
      newPhase = setNugetServiceId(newPhase, servicosNugetsIds);
      return {
        ...newPhase,
        target: {
          ...phase.target,
          queue: queueProjetoAzure,
        },
      };
    }
  );
  buildDefinitionAlterada.queue = queueProjetoAzure;

  const repoEncontrado = repositoriosMigrados.find(
    (repositorio) => repositorio.name === buildDefinition.repository.name
  );

  if (!repoEncontrado) {
    console.error(
      "Repositorio não foi encontrado a partir do nome da build definition: "
    );
    return null;
  }

  buildDefinitionAlterada.repository = {
    ...buildDefinition.repository,
    id: repoEncontrado.id,
    name: repoEncontrado.name,
    url: criaUrlAzureGit(projetoCriado.name, repoEncontrado.name),
  };

  return buildDefinitionAlterada;
}

async function createBuildDefinitions(
  buildDefinitionsList,
  projetoCriado,
  repositoriosMigrados,
  queueProjetoAzure,
  serviceIds
) {
  const buildsDefinitionsAlteradas = buildDefinitionsList.map(
    async (buildDefinitionPromise) => {
      const buildDefinition = await buildDefinitionPromise;
      const novaBuild = getNovaBuildDefinitionsAzure(
        buildDefinition,
        projetoCriado,
        repositoriosMigrados,
        queueProjetoAzure,
        serviceIds
      );
      return novaBuild;
    }
  );

  return buildsDefinitionsAlteradas.map(async (buildDefinitionPromise) => {
    const buildDefinition = await buildDefinitionPromise;
    try {
      const response = await customAxiosAzure.post(
        `${base_url_azure}/${projetoCriado.name}/_apis/build/definitions?api-version=6.0-preview`,
        buildDefinition
      );
      console.log(
        "Build definition criada com sucesso, definação build: " +
          response.data.name
      );
      return response.data;
    } catch (error) {
      console.error(error.response.data);
      return null;
    }
  });
}

async function getRepositoriosCriadosAzure(projetoId) {
  const response = await customAxiosAzure.get(
    `${base_url_azure}/${projetoId}/_apis/git/repositories?api-version=6.0-preview`
  );

  return response.data.value;
}

function getUrlAzureQueue(queueId) {
  return `${base_url_azure}/_apis/build/Queues/${queueId}`;
}

async function getQueueProjetoAzure(projetoId) {
  const response = await customAxiosAzure.get(
    `${base_url_azure}/${projetoId}/_apis/distributedtask/queues?api-version=6.0-preview`
  );

  const defaultQueue = response.data.value.find(
    (queues) => queues.name === "Default"
  );

  const queueTratada = {
    _links: {
      self: {
        href: getUrlAzureQueue(defaultQueue.id),
      },
    },
    id: defaultQueue.id,
    name: "Default",
    url: getUrlAzureQueue(defaultQueue.id),
    pool: {
      id: defaultQueue.pool.id,
      name: "Default",
    },
  };
  return queueTratada;
}

async function getConexoesComServicosAzure(projetoId) {
  const response = await customAxiosAzure.get(
    `${base_url_azure}/${projetoId}/_apis/serviceendpoint/endpoints?api-version=6.0-preview`
  );
  return response.data.value;
}

async function setBuildToRun(build, queueId, projetoId) {
  const response = await customAxiosAzure.post(
    `${base_url_azure}/${build.project.name}/_apis/build/builds?ignoreWarnings=false&api-version=6.0-preview`,
    {
      queue: {
        id: queueId,
      },
      definition: {
        id: build.id,
      },
      project: {
        id: projetoId,
      },
      sourceBranch: "refs/heads/master",
      reason: 1,
      demands: [],
      parameters: '{"system.debug":"false"}',
    }
  );

  return response.data;
}

async function MigracaoRepoTfvc(nomeProjetoTFS) {
  const tfvcInfo = await getInfoStfvc(nomeProjetoTFS);

  const referenciaOperacao = await createProjetoAzure(
    nomeProjetoTFS,
    tfvcInfo.descricaoProjeto
  );

  const status = await esperaProjetoSerCriado(referenciaOperacao);

  if (status !== "succeeded") throw new Error("Projeto não foi criado");

  const milisegundos = 3000;
  console.log(
    `Esperando ${milisegundos / 1000} segundos para o  projeto ser criado`
  );

  setTimeout(async () => {
    const projetoCriado = await getProjetoCriadoNoAzure(nomeProjetoTFS);

    await criaConexoesComServicos(nomeProjetoTFS, projetoCriado.id);

    migracaoProjetoTfvc(projetoCriado);
  }, milisegundos);
}

async function processoFinalDeCriacaoProjetoGit(
  nomeProjetoTFS,
  repositoriosTfs
) {
  const projetoCriado = await getProjetoCriadoNoAzure(nomeProjetoTFS);

  await criaConexoesComServicos(nomeProjetoTFS, projetoCriado.id);

  migracaoRepositoriosParaAzure(repositoriosTfs, projetoCriado);
}

async function MigracaoRepo(nomeProjetoTFS) {
  const repositoriosTfs = await getRepositoriosGit(nomeProjetoTFS);

  const referenciaOperacao = await createProjetoAzure(
    nomeProjetoTFS,
    repositoriosTfs[0].descricaoProjeto
  );

  const status = await esperaProjetoSerCriado(referenciaOperacao);

  if (status !== "succeeded") throw new Error("Projeto não foi criado");

  const milisegundos = 3000;
  console.log(
    `Esperando ${milisegundos / 1000} segundos para o  projeto ser criado`
  );

  setTimeout(
    async () =>
      await processoFinalDeCriacaoProjetoGit(nomeProjetoTFS, repositoriosTfs),
    milisegundos
  );
}

async function MigracaoBuild(nomeProjetoTFS) {
  const repositoriosTfs = await getRepositoriosGit(nomeProjetoTFS);

  const projetoCriado = await getProjetoCriadoNoAzure(
    repositoriosTfs[0].nomeProjeto
  );

  const buildDefinitionList = await getBuildDefinitionsTfs(
    repositoriosTfs[0].idProjeto
  );

  buildDefinitionList.forEach(async (buildPromise) => {
    const build = await buildPromise;
    console.log("Build encontrada:" + build.name);
  });

  const repositoriosMigrados = await getRepositoriosCriadosAzure(
    projetoCriado.id
  );

  repositoriosMigrados.forEach((repo) =>
    console.log("Repositorio migrado: " + repo.name)
  );

  const conexoesServicos = await getConexoesComServicosAzure(projetoCriado.id);

  const queueProjetoAzure = await getQueueProjetoAzure(projetoCriado.id);

  const sonaQubeServiceId = conexoesServicos.find(
    (c) => c.type === "sonarqube"
  ).id;

  const servicosNugetsIds = conexoesServicos.reduce((c, v) => {
    if (v.type === "externalnugetfeed") return c ? c + ", " + v.id : v.id;
  });

  const buildDefinitionsCriadas = await createBuildDefinitions(
    buildDefinitionList,
    projetoCriado,
    repositoriosMigrados,
    queueProjetoAzure,
    { sonaQubeServiceId, servicosNugetsIds }
  );

  buildDefinitionsCriadas.forEach(async (buildPromise) => {
    const build = await buildPromise;
    if (!build)
      return console.error(
        "Ocorreu algum problema na build. Build inexistente."
      );
    console.log("Inicializando build: " + build.name);
    await setBuildToRun(build, queueProjetoAzure.id, projetoCriado.id);
  });
}

////////////////////////////////////////////////////////////////////////////////

if (argv.release || argv.r) {
  if (!argv.nomeProjetoTfs)
    throw new Error("Nome do projeto TFS não informado");
  console.log(
    "Inicializando processo para migração dos RELEASES do projeto TFS: " +
      argv.nomeProjetoTfs
  );
  startMigracaoReleases();
}

////////////////////////////////////////////////////////////////////////////////

if (argv.build || argv.b) {
  if (!argv.nomeProjetoTfs)
    throw new Error("Nome do projeto TFS não informado");
  console.log(
    "Inicializando processo para migração dos BUILDS do projeto TFS: " +
      argv.nomeProjetoTfs
  );
  startMigracaoBuild();
}

if (!(argv.build || argv.b) && !(argv.release || argv.r)) {
  if (!argv.nomeProjetoTfs)
    throw new Error("Nome do projeto TFS não informado");
  console.log(
    "Inicializando processo para migração dos REPOSITÓRIOS TFS: " +
      argv.nomeProjetoTfs
  );
  startMigracaoRepositorios();
}
