const axios = require("axios");
const http = require("http");
const https = require("https");

const base_url_tfs = process.env.BASE_URL_TFS;
const base_url_azure = process.env.BASE_URL_AZURE;
const TOKEN_AZURE_BASE_64 = process.env.TOKEN_AZURE_BASE_64;
const TOKEN_TFS_BASE_64 = process.env.TOKEN_TFS_BASE_64;

const listaServicosConexoesSsh = [
  {
    host: "SSH_IP",
    nome: "Publicação Desenvolvimento",
  },
  {
    host: "SSH_IP",
    nome: "Publicação Homologação",
  },
  {
    host: "SSH_IP",
    nome: "Publicação Produção",
  },
];

const listaServicosNuget = [
  {
    nome: "Nuget Server",
    url: "https://api.nuget.org/v3/index.json",
  },
];

const customAxiosTfs = axios.create({
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: "Basic " + TOKEN_TFS_BASE_64,
  },
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

const customAxiosAzure = axios.create({
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: "Basic " + TOKEN_AZURE_BASE_64,
  },
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

module.exports = {
  listaServicosConexoesSsh,
  customAxiosTfs,
  customAxiosAzure,
  listaServicosNuget,
  base_url_tfs,
  base_url_azure,
  TOKEN_AZURE_BASE_64
};
