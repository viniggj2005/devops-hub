import { CreateNetwork, DeleteNetwork, InspectNetwork, ListNetworks, PruneNetworks } from '../../../../../wailsjs/go/dockerHandlers/DockerSdkHandlerStruct'
import { network } from '../../../../../wailsjs/go/models'

export const NetworkService={

    async pruneAllNetworks(clientId:number):Promise<string>{
        return JSON.parse(await PruneNetworks(clientId))
    },

    async findAllNetworks(clientId:number):Promise<any>{
        return JSON.parse(await ListNetworks(clientId))
    },
    async deleteNetwork(clientId:number,networkId:string):Promise<void>{
        return await DeleteNetwork(clientId,networkId)
    },
    async InspectNetwork(clientId:number,networkId:string):Promise<string>{
        return await InspectNetwork(clientId,networkId)
    },
    async createNetwork(clientId:number,name:string,options:network.CreateOptions):Promise<any>{
        return await CreateNetwork(clientId,name,options)
    }
    




}