export namespace client {
	
	export class Client {
	
	
	    static createFrom(source: any = {}) {
	        return new Client(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

export namespace container {
	
	export class CreateResponse {
	    Id: string;
	    Warnings: string[];
	
	    static createFrom(source: any = {}) {
	        return new CreateResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Id = source["Id"];
	        this.Warnings = source["Warnings"];
	    }
	}
	export class MountPoint {
	    Source: string;
	    Destination: string;
	    Mode: string;
	    RW: boolean;
	    Propagation: string;
	
	    static createFrom(source: any = {}) {
	        return new MountPoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Source = source["Source"];
	        this.Destination = source["Destination"];
	        this.Mode = source["Mode"];
	        this.RW = source["RW"];
	        this.Propagation = source["Propagation"];
	    }
	}
	export class NetworkSettingsSummary {
	    Networks: Record<string, network.EndpointSettings>;
	
	    static createFrom(source: any = {}) {
	        return new NetworkSettingsSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Networks = this.convertValues(source["Networks"], network.EndpointSettings, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Port {
	    IP?: string;
	    PrivatePort: number;
	    PublicPort?: number;
	    Type: string;
	
	    static createFrom(source: any = {}) {
	        return new Port(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.IP = source["IP"];
	        this.PrivatePort = source["PrivatePort"];
	        this.PublicPort = source["PublicPort"];
	        this.Type = source["Type"];
	    }
	}
	export class Summary {
	    Id: string;
	    Names: string[];
	    Image: string;
	    ImageID: string;
	    ImageManifestDescriptor?: v1.Descriptor;
	    Command: string;
	    Created: number;
	    Ports: Port[];
	    Labels: Record<string, string>;
	    State: string;
	    Status: string;
	    // Go type: struct { NetworkMode string "json:\",omitempty\""; Annotations map[string]string "json:\",omitempty\"" }
	    HostConfig: any;
	    NetworkSettings?: NetworkSettingsSummary;
	    Mounts: MountPoint[];
	
	    static createFrom(source: any = {}) {
	        return new Summary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Id = source["Id"];
	        this.Names = source["Names"];
	        this.Image = source["Image"];
	        this.ImageID = source["ImageID"];
	        this.ImageManifestDescriptor = this.convertValues(source["ImageManifestDescriptor"], v1.Descriptor);
	        this.Command = source["Command"];
	        this.Created = source["Created"];
	        this.Ports = this.convertValues(source["Ports"], Port);
	        this.Labels = source["Labels"];
	        this.State = source["State"];
	        this.Status = source["Status"];
	        this.HostConfig = this.convertValues(source["HostConfig"], Object);
	        this.NetworkSettings = this.convertValues(source["NetworkSettings"], NetworkSettingsSummary);
	        this.Mounts = this.convertValues(source["Mounts"], MountPoint);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace dtos {
	
	export class ContainerCreateOptions {
	    config: Record<string, any>;
	    platform?: v1.Platform;
	    hostConfig: Record<string, any>;
	    networkingConfig: Record<string, any>;
	    containerName: string;
	
	    static createFrom(source: any = {}) {
	        return new ContainerCreateOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.config = source["config"];
	        this.platform = this.convertValues(source["platform"], v1.Platform);
	        this.hostConfig = source["hostConfig"];
	        this.networkingConfig = source["networkingConfig"];
	        this.containerName = source["containerName"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CreateDockerConnectionDto {
	    alias: string;
	    description: string;
	    url: string;
	    ca: string;
	    cert: string;
	    key: string;
	    userId: number;
	
	    static createFrom(source: any = {}) {
	        return new CreateDockerConnectionDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.alias = source["alias"];
	        this.description = source["description"];
	        this.url = source["url"];
	        this.ca = source["ca"];
	        this.cert = source["cert"];
	        this.key = source["key"];
	        this.userId = source["userId"];
	    }
	}
	export class CreateSshConnectionInputDto {
	    host: string;
	    systemUser: string;
	    alias?: string;
	    port?: number;
	    key?: string;
	    knownHosts?: string;
	    userId: number;
	
	    static createFrom(source: any = {}) {
	        return new CreateSshConnectionInputDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.systemUser = source["systemUser"];
	        this.alias = source["alias"];
	        this.port = source["port"];
	        this.key = source["key"];
	        this.knownHosts = source["knownHosts"];
	        this.userId = source["userId"];
	    }
	}
	export class CreateUserInputDto {
	    nome: string;
	    email: string;
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateUserInputDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nome = source["nome"];
	        this.email = source["email"];
	        this.password = source["password"];
	    }
	}
	export class ImageCreateDto {
	    path: string;
	    name: string;
	    tag: string;
	    dockerfile: string;
	
	    static createFrom(source: any = {}) {
	        return new ImageCreateDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.tag = source["tag"];
	        this.dockerfile = source["dockerfile"];
	    }
	}
	export class LoginInputDto {
	    email: string;
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new LoginInputDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.email = source["email"];
	        this.password = source["password"];
	    }
	}
	export class UserDTO {
	    id: number;
	    nome: string;
	    email: string;
	
	    static createFrom(source: any = {}) {
	        return new UserDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.nome = source["nome"];
	        this.email = source["email"];
	    }
	}
	export class LoginResponseDto {
	    token: string;
	    user: UserDTO;
	
	    static createFrom(source: any = {}) {
	        return new LoginResponseDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.token = source["token"];
	        this.user = this.convertValues(source["user"], UserDTO);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SSHConnectionDto {
	    SshSessionId: string;
	    Host: string;
	    Port: number;
	    User: string;
	    Password: string;
	    Key: number[];
	    KeyPath: string;
	    Passphrase: string;
	    KnownHostsPath: string;
	    InsecureIgnoreHostKey: boolean;
	    Cols: number;
	    Rows: number;
	    Timeout: number;
	
	    static createFrom(source: any = {}) {
	        return new SSHConnectionDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.SshSessionId = source["SshSessionId"];
	        this.Host = source["Host"];
	        this.Port = source["Port"];
	        this.User = source["User"];
	        this.Password = source["Password"];
	        this.Key = source["Key"];
	        this.KeyPath = source["KeyPath"];
	        this.Passphrase = source["Passphrase"];
	        this.KnownHostsPath = source["KnownHostsPath"];
	        this.InsecureIgnoreHostKey = source["InsecureIgnoreHostKey"];
	        this.Cols = source["Cols"];
	        this.Rows = source["Rows"];
	        this.Timeout = source["Timeout"];
	    }
	}
	export class SshDto {
	    id: number;
	    host: string;
	    alias?: string;
	    systemUser: string;
	    port?: number;
	    key?: string;
	    knownHosts?: string;
	    userId: number;
	
	    static createFrom(source: any = {}) {
	        return new SshDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.host = source["host"];
	        this.alias = source["alias"];
	        this.systemUser = source["systemUser"];
	        this.port = source["port"];
	        this.key = source["key"];
	        this.knownHosts = source["knownHosts"];
	        this.userId = source["userId"];
	    }
	}
	export class SystemInfoDto {
	    ID: string;
	    Name: string;
	    NCPU: number;
	    Images: number;
	    MemTotal: number;
	    SystemTime: string;
	    Containers: number;
	    Architecture: string;
	    ServerVersion: string;
	    OperatingSystem: string;
	    ContainersPaused: number;
	    ContainersStopped: number;
	    ContainersRunning: number;
	
	    static createFrom(source: any = {}) {
	        return new SystemInfoDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.Name = source["Name"];
	        this.NCPU = source["NCPU"];
	        this.Images = source["Images"];
	        this.MemTotal = source["MemTotal"];
	        this.SystemTime = source["SystemTime"];
	        this.Containers = source["Containers"];
	        this.Architecture = source["Architecture"];
	        this.ServerVersion = source["ServerVersion"];
	        this.OperatingSystem = source["OperatingSystem"];
	        this.ContainersPaused = source["ContainersPaused"];
	        this.ContainersStopped = source["ContainersStopped"];
	        this.ContainersRunning = source["ContainersRunning"];
	    }
	}
	export class UpdateUserInputDto {
	    nome?: string;
	    email?: string;
	    password?: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateUserInputDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nome = source["nome"];
	        this.email = source["email"];
	        this.password = source["password"];
	    }
	}

}

export namespace handlers {
	
	export class DockerSdkHandlerStruct {
	
	
	    static createFrom(source: any = {}) {
	        return new DockerSdkHandlerStruct(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}
	export class sshConnection {
	
	
	    static createFrom(source: any = {}) {
	        return new sshConnection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

export namespace image {
	
	export class AttestationProperties {
	    For: string;
	
	    static createFrom(source: any = {}) {
	        return new AttestationProperties(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.For = source["For"];
	    }
	}
	export class DeleteResponse {
	    Deleted?: string;
	    Untagged?: string;
	
	    static createFrom(source: any = {}) {
	        return new DeleteResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Deleted = source["Deleted"];
	        this.Untagged = source["Untagged"];
	    }
	}
	export class ImageProperties {
	    Platform: v1.Platform;
	    // Go type: struct { Unpacked int64 "json:\"Unpacked\"" }
	    Size: any;
	    Containers: string[];
	
	    static createFrom(source: any = {}) {
	        return new ImageProperties(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Platform = this.convertValues(source["Platform"], v1.Platform);
	        this.Size = this.convertValues(source["Size"], Object);
	        this.Containers = source["Containers"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ManifestSummary {
	    ID: string;
	    Descriptor: v1.Descriptor;
	    Available: boolean;
	    // Go type: struct { Content int64 "json:\"Content\""; Total int64 "json:\"Total\"" }
	    Size: any;
	    Kind: string;
	    ImageData?: ImageProperties;
	    AttestationData?: AttestationProperties;
	
	    static createFrom(source: any = {}) {
	        return new ManifestSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.Descriptor = this.convertValues(source["Descriptor"], v1.Descriptor);
	        this.Available = source["Available"];
	        this.Size = this.convertValues(source["Size"], Object);
	        this.Kind = source["Kind"];
	        this.ImageData = this.convertValues(source["ImageData"], ImageProperties);
	        this.AttestationData = this.convertValues(source["AttestationData"], AttestationProperties);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PruneReport {
	    ImagesDeleted: DeleteResponse[];
	    SpaceReclaimed: number;
	
	    static createFrom(source: any = {}) {
	        return new PruneReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ImagesDeleted = this.convertValues(source["ImagesDeleted"], DeleteResponse);
	        this.SpaceReclaimed = source["SpaceReclaimed"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Summary {
	    Containers: number;
	    Created: number;
	    Id: string;
	    Labels: Record<string, string>;
	    ParentId: string;
	    Descriptor?: v1.Descriptor;
	    Manifests?: ManifestSummary[];
	    RepoDigests: string[];
	    RepoTags: string[];
	    SharedSize: number;
	    Size: number;
	    VirtualSize?: number;
	
	    static createFrom(source: any = {}) {
	        return new Summary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Containers = source["Containers"];
	        this.Created = source["Created"];
	        this.Id = source["Id"];
	        this.Labels = source["Labels"];
	        this.ParentId = source["ParentId"];
	        this.Descriptor = this.convertValues(source["Descriptor"], v1.Descriptor);
	        this.Manifests = this.convertValues(source["Manifests"], ManifestSummary);
	        this.RepoDigests = source["RepoDigests"];
	        this.RepoTags = source["RepoTags"];
	        this.SharedSize = source["SharedSize"];
	        this.Size = source["Size"];
	        this.VirtualSize = source["VirtualSize"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace models {
	
	export class SshConnectionModel {
	    ID: number;
	    // Go type: time
	    CreatedAt: any;
	    // Go type: time
	    UpdatedAt: any;
	    // Go type: gorm
	    DeletedAt: any;
	    alias: string;
	    Host: types.EncryptedString;
	    systemUser: string;
	    port: number;
	    Key: types.EncryptedString;
	    KnownHostsData: types.EncryptedString;
	    UserID: number;
	    User: UserModel;
	
	    static createFrom(source: any = {}) {
	        return new SshConnectionModel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.CreatedAt = this.convertValues(source["CreatedAt"], null);
	        this.UpdatedAt = this.convertValues(source["UpdatedAt"], null);
	        this.DeletedAt = this.convertValues(source["DeletedAt"], null);
	        this.alias = source["alias"];
	        this.Host = this.convertValues(source["Host"], types.EncryptedString);
	        this.systemUser = source["systemUser"];
	        this.port = source["port"];
	        this.Key = this.convertValues(source["Key"], types.EncryptedString);
	        this.KnownHostsData = this.convertValues(source["KnownHostsData"], types.EncryptedString);
	        this.UserID = source["UserID"];
	        this.User = this.convertValues(source["User"], UserModel);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UserModel {
	    ID: number;
	    // Go type: time
	    CreatedAt: any;
	    // Go type: time
	    UpdatedAt: any;
	    // Go type: gorm
	    DeletedAt: any;
	    nome: string;
	    email: string;
	    Docker: DockerCredentialsModel[];
	    Ssh: SshConnectionModel[];
	
	    static createFrom(source: any = {}) {
	        return new UserModel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.CreatedAt = this.convertValues(source["CreatedAt"], null);
	        this.UpdatedAt = this.convertValues(source["UpdatedAt"], null);
	        this.DeletedAt = this.convertValues(source["DeletedAt"], null);
	        this.nome = source["nome"];
	        this.email = source["email"];
	        this.Docker = this.convertValues(source["Docker"], DockerCredentialsModel);
	        this.Ssh = this.convertValues(source["Ssh"], SshConnectionModel);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DockerCredentialsModel {
	    ID: number;
	    // Go type: time
	    CreatedAt: any;
	    // Go type: time
	    UpdatedAt: any;
	    // Go type: gorm
	    DeletedAt: any;
	    Alias: string;
	    Url: types.EncryptedString;
	    Description: string;
	    Ca: types.EncryptedString;
	    Cert: types.EncryptedString;
	    Key: types.EncryptedString;
	    UserID: number;
	    User: UserModel;
	
	    static createFrom(source: any = {}) {
	        return new DockerCredentialsModel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.CreatedAt = this.convertValues(source["CreatedAt"], null);
	        this.UpdatedAt = this.convertValues(source["UpdatedAt"], null);
	        this.DeletedAt = this.convertValues(source["DeletedAt"], null);
	        this.Alias = source["Alias"];
	        this.Url = this.convertValues(source["Url"], types.EncryptedString);
	        this.Description = source["Description"];
	        this.Ca = this.convertValues(source["Ca"], types.EncryptedString);
	        this.Cert = this.convertValues(source["Cert"], types.EncryptedString);
	        this.Key = this.convertValues(source["Key"], types.EncryptedString);
	        this.UserID = source["UserID"];
	        this.User = this.convertValues(source["User"], UserModel);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace network {
	
	export class ConfigReference {
	    Network: string;
	
	    static createFrom(source: any = {}) {
	        return new ConfigReference(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Network = source["Network"];
	    }
	}
	export class IPAMConfig {
	    AuxiliaryAddresses?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new IPAMConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.AuxiliaryAddresses = source["AuxiliaryAddresses"];
	    }
	}
	export class IPAM {
	    Driver: string;
	    Options: Record<string, string>;
	    Config: IPAMConfig[];
	
	    static createFrom(source: any = {}) {
	        return new IPAM(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Driver = source["Driver"];
	        this.Options = source["Options"];
	        this.Config = this.convertValues(source["Config"], IPAMConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CreateOptions {
	    Driver: string;
	    Scope: string;
	    IPAM?: IPAM;
	    Internal: boolean;
	    Attachable: boolean;
	    Ingress: boolean;
	    ConfigOnly: boolean;
	    ConfigFrom?: ConfigReference;
	    Options: Record<string, string>;
	    Labels: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new CreateOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Driver = source["Driver"];
	        this.Scope = source["Scope"];
	        this.IPAM = this.convertValues(source["IPAM"], IPAM);
	        this.Internal = source["Internal"];
	        this.Attachable = source["Attachable"];
	        this.Ingress = source["Ingress"];
	        this.ConfigOnly = source["ConfigOnly"];
	        this.ConfigFrom = this.convertValues(source["ConfigFrom"], ConfigReference);
	        this.Options = source["Options"];
	        this.Labels = source["Labels"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EndpointIPAMConfig {
	
	
	    static createFrom(source: any = {}) {
	        return new EndpointIPAMConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}
	export class EndpointSettings {
	    // Go type: EndpointIPAMConfig
	    IPAMConfig?: any;
	    Links: string[];
	    Aliases: string[];
	    MacAddress: string;
	    DriverOpts: Record<string, string>;
	    GwPriority: number;
	    NetworkID: string;
	    EndpointID: string;
	    Gateway: string;
	    IPAddress: string;
	    IPPrefixLen: number;
	    IPv6Gateway: string;
	    GlobalIPv6Address: string;
	    GlobalIPv6PrefixLen: number;
	    DNSNames: string[];
	
	    static createFrom(source: any = {}) {
	        return new EndpointSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.IPAMConfig = this.convertValues(source["IPAMConfig"], null);
	        this.Links = source["Links"];
	        this.Aliases = source["Aliases"];
	        this.MacAddress = source["MacAddress"];
	        this.DriverOpts = source["DriverOpts"];
	        this.GwPriority = source["GwPriority"];
	        this.NetworkID = source["NetworkID"];
	        this.EndpointID = source["EndpointID"];
	        this.Gateway = source["Gateway"];
	        this.IPAddress = source["IPAddress"];
	        this.IPPrefixLen = source["IPPrefixLen"];
	        this.IPv6Gateway = source["IPv6Gateway"];
	        this.GlobalIPv6Address = source["GlobalIPv6Address"];
	        this.GlobalIPv6PrefixLen = source["GlobalIPv6PrefixLen"];
	        this.DNSNames = source["DNSNames"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace types {
	
	export class EncryptedString {
	    Ciphertext: number[];
	    Plaintext: string;
	
	    static createFrom(source: any = {}) {
	        return new EncryptedString(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Ciphertext = source["Ciphertext"];
	        this.Plaintext = source["Plaintext"];
	    }
	}

}

export namespace v1 {
	
	export class Platform {
	    architecture: string;
	    os: string;
	    "os.version"?: string;
	    "os.features"?: string[];
	    variant?: string;
	
	    static createFrom(source: any = {}) {
	        return new Platform(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.architecture = source["architecture"];
	        this.os = source["os"];
	        this["os.version"] = source["os.version"];
	        this["os.features"] = source["os.features"];
	        this.variant = source["variant"];
	    }
	}
	export class Descriptor {
	    mediaType: string;
	    digest: string;
	    size: number;
	    urls?: string[];
	    annotations?: Record<string, string>;
	    data?: number[];
	    platform?: Platform;
	    artifactType?: string;
	
	    static createFrom(source: any = {}) {
	        return new Descriptor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mediaType = source["mediaType"];
	        this.digest = source["digest"];
	        this.size = source["size"];
	        this.urls = source["urls"];
	        this.annotations = source["annotations"];
	        this.data = source["data"];
	        this.platform = this.convertValues(source["platform"], Platform);
	        this.artifactType = source["artifactType"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace volume {
	
	export class CapacityRange {
	    RequiredBytes: number;
	    LimitBytes: number;
	
	    static createFrom(source: any = {}) {
	        return new CapacityRange(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.RequiredBytes = source["RequiredBytes"];
	        this.LimitBytes = source["LimitBytes"];
	    }
	}
	export class TopologyRequirement {
	
	
	    static createFrom(source: any = {}) {
	        return new TopologyRequirement(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}
	export class TypeBlock {
	
	
	    static createFrom(source: any = {}) {
	        return new TypeBlock(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}
	export class TypeMount {
	
	
	    static createFrom(source: any = {}) {
	        return new TypeMount(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}
	export class AccessMode {
	    // Go type: TypeMount
	    ""?: any;
	    // Go type: TypeBlock
	    ""?: any;
	
	    static createFrom(source: any = {}) {
	        return new AccessMode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this[""] = this.convertValues(source[""], null);
	        this[""] = this.convertValues(source[""], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ClusterVolumeSpec {
	    // Go type: AccessMode
	    ""?: any;
	    // Go type: TopologyRequirement
	    ""?: any;
	    // Go type: CapacityRange
	    ""?: any;
	
	    static createFrom(source: any = {}) {
	        return new ClusterVolumeSpec(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this[""] = this.convertValues(source[""], null);
	        this[""] = this.convertValues(source[""], null);
	        this[""] = this.convertValues(source[""], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CreateOptions {
	    // Go type: ClusterVolumeSpec
	    ClusterVolumeSpec?: any;
	    Driver?: string;
	    DriverOpts?: Record<string, string>;
	    Labels?: Record<string, string>;
	    Name?: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ClusterVolumeSpec = this.convertValues(source["ClusterVolumeSpec"], null);
	        this.Driver = source["Driver"];
	        this.DriverOpts = source["DriverOpts"];
	        this.Labels = source["Labels"];
	        this.Name = source["Name"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

