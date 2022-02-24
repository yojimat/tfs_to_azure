# Migration of TFS projects to Azure

This script was created to migrate old projects, both in Git or TFVC source. Every repository will be copied. The builds and releases of the project can also be copied. Azure service connections can be made if you put them in the array of connections in the 'constantes.js'.  
The code is predominantly in portuguese; the script was initially made with the intention of sharing to make the life of other fellows developers easier, with that in mind portugue was the language of choice.   

## Installation

Inside in the directory of the project, after you have cloned it.  
Install the node dependencies

```bash
npm install
```

Install [git-tfs](https://github.com/git-tfs/git-tfs), follow the instructions in the linked repository. remember to put in the PATH.  
Create a directory name 'repo', this is where the projects will be downloaded and deleted after use.  
Create the file .env with names described the bellow, and fill them with your values:

- TOKEN_AZURE_BASE_64
- TOKEN_TFS_BASE_64
- BASE_URL_TFS
- BASE_URL_AZURE

The urls need to have the name of the organization, e.g., 'http://azure.com/ORGANIZATION_NAME'.  
The tokens are created in the Azure/TFS servers and you need to transform them to base64.

## Usage
```bash
node . --nomeProjetoTfs 'Nome do projeto' [-r<b>] [--repositorioTfvc]
```
Where `-b` is for clone the builds and `-r` for the releases, use just one, and use `--repositorioTfvc` when the TFS repository is in TFVC source.
If you just want to migrate the repositories of the project and create some services connections don't pass the optional arguments.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
