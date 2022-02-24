const {
  customAxiosTfs,
  customAxiosAzure,
  base_url_tfs,
  base_url_azure,
} = require("./constantes");

async function getRepositoriosGit(nomeProjeto) {
  const response = await customAxiosTfs.get(
    `${base_url_tfs}/_apis/git/repositories?api-version=3.2-preview`
  );

  const repositorios = response.data.value;
  const repositoriosFiltrados = repositorios.filter((repositorio) => {
    return repositorio.project.name.includes(nomeProjeto);
  });
  const repositoriosMapeados = repositoriosFiltrados.map((repositorio) => ({
    nomeRepositorio: repositorio.name,
    gitUrl: repositorio.remoteUrl,
    nomeProjeto: repositorio.project.name,
    idProjeto: repositorio.project.id,
    descricaoProjeto: repositorio.project.description,
  }));
  console.log("Repositorios encontrados: ");
  repositoriosMapeados.forEach((repositorio) => console.log(repositorio));
  return repositoriosMapeados;
}

async function getProjetoCriadoNoAzure(nomeProjeto) {
  let tentativas = 0;
  let projetoCriado = null;
  do {
    const response = await customAxiosAzure.get(
      `${base_url_azure}/_apis/projects?api-version=6.0-preview`
    );
    const projetos = response.data.value;
    projetoCriado = projetos.find((projeto) => {
      return (
        projeto.name === nomeProjeto
      );
    });
    tentativas++;
  } while (!projetoCriado && tentativas < 3);

  console.log("Projeto criado: ");
  console.log(projetoCriado);
  return projetoCriado;
}

async function getInfoStfvc(nomeProjeto) {
  try {
    const response = await customAxiosTfs.get(
      `${base_url_tfs}/_apis/projects?api-version=3.2-preview`
    );

    const infoProjeto = response.data.value.find((projeto) => {
      return projeto.name === nomeProjeto;
    });

    const descricaoProjeto = infoProjeto.description
      ? infoProjeto.description + "(PROJETO MIGRADO DO TFVC PARA O GIT)."
      : "PROJETO MIGRADO DO TFVC PARA O GIT.";

    return {
      idProjeto: infoProjeto.id,
      nomeProjeto: infoProjeto.name,
      descricaoProjeto,
    };
  } catch (error) {
    console.error(error.response);
    return [];
  }
}

module.exports = {
  getRepositoriosGit,
  getProjetoCriadoNoAzure,
  getInfoStfvc,
};
