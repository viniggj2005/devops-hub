export namespace authDtos {
	
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
	export class LoginResponseDto {
	    token: string;
	    user: userDtos.UserDTO;
	
	    static createFrom(source: any = {}) {
	        return new LoginResponseDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.token = source["token"];
	        this.user = this.convertValues(source["user"], userDtos.UserDTO);
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

export namespace dockerDtos {
	
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

}

export namespace dockerHandlers {
	
	export class DockerSdkHandlerStruct {
	
	
	    static createFrom(source: any = {}) {
	        return new DockerSdkHandlerStruct(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

export namespace ferretshellDtos {
	
	export class CreateSshConnectionInputDto {
	    host: string;
	    systemUser: string;
	    alias?: string;
	    port?: number;
	    key?: string;
	    password?: string;
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
	        this.password = source["password"];
	        this.knownHosts = source["knownHosts"];
	        this.userId = source["userId"];
	    }
	}
	export class LocalShellDto {
	    id: string;
	    kind: string;
	    name: string;
	    isDefault: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LocalShellDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.isDefault = source["isDefault"];
	    }
	}
	export class LocalTerminalStartDto {
	    cols: number;
	    rows: number;
	    shellId: string;
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalTerminalStartDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cols = source["cols"];
	        this.rows = source["rows"];
	        this.shellId = source["shellId"];
	        this.sessionId = source["sessionId"];
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
	    password?: string;
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
	        this.password = source["password"];
	        this.port = source["port"];
	        this.key = source["key"];
	        this.knownHosts = source["knownHosts"];
	        this.userId = source["userId"];
	    }
	}

}

export namespace ferretshellHandlers {
	
	export class LocalFileInfo {
	    name: string;
	    size: number;
	    isDir: boolean;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalFileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.size = source["size"];
	        this.isDir = source["isDir"];
	        this.path = source["path"];
	    }
	}
	export class SftpFileInfo {
	    name: string;
	    size: number;
	    isDir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SftpFileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.size = source["size"];
	        this.isDir = source["isDir"];
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

export namespace generalConfigsDtos {
	
	export class GeneralConfigDto {
	    id: number;
	    config: string;
	    isActive: boolean;
	    configType: string;
	    moduleName: string;
	
	    static createFrom(source: any = {}) {
	        return new GeneralConfigDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.config = source["config"];
	        this.isActive = source["isActive"];
	        this.configType = source["configType"];
	        this.moduleName = source["moduleName"];
	    }
	}
	export class SaveGeneralConfigInputDto {
	    config: string;
	    configType: string;
	    moduleName: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveGeneralConfigInputDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.config = source["config"];
	        this.configType = source["configType"];
	        this.moduleName = source["moduleName"];
	    }
	}
	export class SaveThemeProfileInputDto {
	    id: number;
	    name: string;
	    config: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveThemeProfileInputDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.config = source["config"];
	    }
	}
	export class ThemeProfileDto {
	    id: number;
	    name: string;
	    config: string;
	
	    static createFrom(source: any = {}) {
	        return new ThemeProfileDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.config = source["config"];
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
	
	export class PostgresConnectionModel {
	    ID: number;
	    // Go type: time
	    CreatedAt: any;
	    // Go type: time
	    UpdatedAt: any;
	    // Go type: gorm
	    DeletedAt: any;
	    Alias: string;
	    Host: types.EncryptedString;
	    Port: number;
	    Database: string;
	    Username: string;
	    Password: types.EncryptedString;
	    SslMode: string;
	    UserID: number;
	    User: UserModel;
	
	    static createFrom(source: any = {}) {
	        return new PostgresConnectionModel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.CreatedAt = this.convertValues(source["CreatedAt"], null);
	        this.UpdatedAt = this.convertValues(source["UpdatedAt"], null);
	        this.DeletedAt = this.convertValues(source["DeletedAt"], null);
	        this.Alias = source["Alias"];
	        this.Host = this.convertValues(source["Host"], types.EncryptedString);
	        this.Port = source["Port"];
	        this.Database = source["Database"];
	        this.Username = source["Username"];
	        this.Password = this.convertValues(source["Password"], types.EncryptedString);
	        this.SslMode = source["SslMode"];
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
	    Password: types.EncryptedString;
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
	        this.Password = this.convertValues(source["Password"], types.EncryptedString);
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
	    Postgres: PostgresConnectionModel[];
	
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
	        this.Postgres = this.convertValues(source["Postgres"], PostgresConnectionModel);
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
	    Description: string;
	    Url: types.EncryptedString;
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
	        this.Description = source["Description"];
	        this.Url = this.convertValues(source["Url"], types.EncryptedString);
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

export namespace octohubDtos {
	
	export class DeviceCodeDto {
	    userCode: string;
	    expiresIn: number;
	    verificationUri: string;
	
	    static createFrom(source: any = {}) {
	        return new DeviceCodeDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.userCode = source["userCode"];
	        this.expiresIn = source["expiresIn"];
	        this.verificationUri = source["verificationUri"];
	    }
	}
	export class GitCredentialDto {
	    id: number;
	    host: string;
	    hasKey: boolean;
	    username: string;
	    hasPassword: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GitCredentialDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.host = source["host"];
	        this.hasKey = source["hasKey"];
	        this.username = source["username"];
	        this.hasPassword = source["hasPassword"];
	    }
	}
	export class GitCredentialInput {
	    host: string;
	    username: string;
	    password: string;
	    privateKey: string;
	    passphrase: string;
	
	    static createFrom(source: any = {}) {
	        return new GitCredentialInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.privateKey = source["privateKey"];
	        this.passphrase = source["passphrase"];
	    }
	}
	export class GithubAccountDto {
	    id: number;
	    name: string;
	    login: string;
	    githubId: number;
	    isActive: boolean;
	    avatarUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new GithubAccountDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.login = source["login"];
	        this.githubId = source["githubId"];
	        this.isActive = source["isActive"];
	        this.avatarUrl = source["avatarUrl"];
	    }
	}
	export class RemoteRepositoryDto {
	    fork: boolean;
	    name: string;
	    owner: string;
	    private: boolean;
	    archived: boolean;
	    cloneUrl: string;
	    fullName: string;
	    localPath: string;
	    updatedAt: string;
	    description: string;
	    localRepositoryId: number;
	
	    static createFrom(source: any = {}) {
	        return new RemoteRepositoryDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fork = source["fork"];
	        this.name = source["name"];
	        this.owner = source["owner"];
	        this.private = source["private"];
	        this.archived = source["archived"];
	        this.cloneUrl = source["cloneUrl"];
	        this.fullName = source["fullName"];
	        this.localPath = source["localPath"];
	        this.updatedAt = source["updatedAt"];
	        this.description = source["description"];
	        this.localRepositoryId = source["localRepositoryId"];
	    }
	}
	export class RepositoryDto {
	    id: number;
	    name: string;
	    path: string;
	    exists: boolean;
	    isCurrent: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RepositoryDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.exists = source["exists"];
	        this.isCurrent = source["isCurrent"];
	    }
	}

}

export namespace octohubStructs {
	
	export class BranchComparison {
	    Ahead: number;
	    Behind: number;
	
	    static createFrom(source: any = {}) {
	        return new BranchComparison(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Ahead = source["Ahead"];
	        this.Behind = source["Behind"];
	    }
	}
	export class BranchInfo {
	    Ahead: number;
	    Behind: number;
	    IsCurrent: boolean;
	    IsRemote: boolean;
	    Name: string;
	    Upstream: string;
	
	    static createFrom(source: any = {}) {
	        return new BranchInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Ahead = source["Ahead"];
	        this.Behind = source["Behind"];
	        this.IsCurrent = source["IsCurrent"];
	        this.IsRemote = source["IsRemote"];
	        this.Name = source["Name"];
	        this.Upstream = source["Upstream"];
	    }
	}
	export class Commit {
	    Hash: string;
	    Author: string;
	    Email: string;
	    PseudoEmail: string;
	    Date: string;
	    Title: string;
	    Tags: string[];
	
	    static createFrom(source: any = {}) {
	        return new Commit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Hash = source["Hash"];
	        this.Author = source["Author"];
	        this.Email = source["Email"];
	        this.PseudoEmail = source["PseudoEmail"];
	        this.Date = source["Date"];
	        this.Title = source["Title"];
	        this.Tags = source["Tags"];
	    }
	}
	export class CommitFileSelection {
	    All: boolean;
	    Lines: number[];
	    FileName: string;
	    OldFileName: string;
	    Kind: string;
	    DiffHash: string;
	
	    static createFrom(source: any = {}) {
	        return new CommitFileSelection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.All = source["All"];
	        this.Lines = source["Lines"];
	        this.FileName = source["FileName"];
	        this.OldFileName = source["OldFileName"];
	        this.Kind = source["Kind"];
	        this.DiffHash = source["DiffHash"];
	    }
	}
	export class CommitRequest {
	    Summary: string;
	    Description: string;
	    Files: CommitFileSelection[];
	
	    static createFrom(source: any = {}) {
	        return new CommitRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Summary = source["Summary"];
	        this.Description = source["Description"];
	        this.Files = this.convertValues(source["Files"], CommitFileSelection);
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
	export class ConflictFile {
	    Markers: number;
	    Binary: boolean;
	    Resolved: boolean;
	    SameAsOurs: boolean;
	    File: string;
	    Kind: string;
	
	    static createFrom(source: any = {}) {
	        return new ConflictFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Markers = source["Markers"];
	        this.Binary = source["Binary"];
	        this.Resolved = source["Resolved"];
	        this.SameAsOurs = source["SameAsOurs"];
	        this.File = source["File"];
	        this.Kind = source["Kind"];
	    }
	}
	export class OperationState {
	    Step: number;
	    Total: number;
	    Kind: string;
	    Branch: string;
	    Message: string;
	    ConflictingFiles: string[];
	
	    static createFrom(source: any = {}) {
	        return new OperationState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Step = source["Step"];
	        this.Total = source["Total"];
	        this.Kind = source["Kind"];
	        this.Branch = source["Branch"];
	        this.Message = source["Message"];
	        this.ConflictingFiles = source["ConflictingFiles"];
	    }
	}
	export class ConflictReport {
	    Files: ConflictFile[];
	    Operation: OperationState;
	
	    static createFrom(source: any = {}) {
	        return new ConflictReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Files = this.convertValues(source["Files"], ConflictFile);
	        this.Operation = this.convertValues(source["Operation"], OperationState);
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
	export class FileModification {
	    File: string;
	    Status: string;
	
	    static createFrom(source: any = {}) {
	        return new FileModification(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.File = source["File"];
	        this.Status = source["Status"];
	    }
	}
	export class FilesStatus {
	    FileName: string;
	    OldFileName: string;
	    Status: string;
	    Kind: string;
	
	    static createFrom(source: any = {}) {
	        return new FilesStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.FileName = source["FileName"];
	        this.OldFileName = source["OldFileName"];
	        this.Status = source["Status"];
	        this.Kind = source["Kind"];
	    }
	}
	export class MergePreview {
	    Ahead: number;
	    Behind: number;
	    UpToDate: boolean;
	    CanFastForward: boolean;
	    Commits: Commit[];
	    ConflictingFiles: string[];
	
	    static createFrom(source: any = {}) {
	        return new MergePreview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Ahead = source["Ahead"];
	        this.Behind = source["Behind"];
	        this.UpToDate = source["UpToDate"];
	        this.CanFastForward = source["CanFastForward"];
	        this.Commits = this.convertValues(source["Commits"], Commit);
	        this.ConflictingFiles = source["ConflictingFiles"];
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
	
	export class ReorderableCommit {
	    Pushed: boolean;
	    Hash: string;
	    Title: string;
	    Author: string;
	    ShortHash: string;
	
	    static createFrom(source: any = {}) {
	        return new ReorderableCommit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Pushed = source["Pushed"];
	        this.Hash = source["Hash"];
	        this.Title = source["Title"];
	        this.Author = source["Author"];
	        this.ShortHash = source["ShortHash"];
	    }
	}
	export class Stash {
	    ID: string;
	    Branch: string;
	    Message: string;
	
	    static createFrom(source: any = {}) {
	        return new Stash(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.Branch = source["Branch"];
	        this.Message = source["Message"];
	    }
	}
	export class WorkingFileDiff {
	    Diff: string;
	    Hash: string;
	
	    static createFrom(source: any = {}) {
	        return new WorkingFileDiff(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Diff = source["Diff"];
	        this.Hash = source["Hash"];
	    }
	}

}

export namespace postgresDtos {
	
	export class CellValueDto {
	    column: number;
	    value?: string;
	
	    static createFrom(source: any = {}) {
	        return new CellValueDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.column = source["column"];
	        this.value = source["value"];
	    }
	}
	export class ColumnDto {
	    position: number;
	    name: string;
	    quotedName: string;
	    dataType: string;
	    notNull: boolean;
	    defaultValue?: string;
	    isPrimaryKey: boolean;
	    isForeignKey: boolean;
	    identity: string;
	    generated: string;
	    collation?: string;
	    comment?: string;
	
	    static createFrom(source: any = {}) {
	        return new ColumnDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.position = source["position"];
	        this.name = source["name"];
	        this.quotedName = source["quotedName"];
	        this.dataType = source["dataType"];
	        this.notNull = source["notNull"];
	        this.defaultValue = source["defaultValue"];
	        this.isPrimaryKey = source["isPrimaryKey"];
	        this.isForeignKey = source["isForeignKey"];
	        this.identity = source["identity"];
	        this.generated = source["generated"];
	        this.collation = source["collation"];
	        this.comment = source["comment"];
	    }
	}
	export class CompletionTableDto {
	    schema: string;
	    name: string;
	    columns: string[];
	
	    static createFrom(source: any = {}) {
	        return new CompletionTableDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.schema = source["schema"];
	        this.name = source["name"];
	        this.columns = source["columns"];
	    }
	}
	export class ConnectionTestResultDto {
	    serverVersion: string;
	    latencyMs: number;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionTestResultDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serverVersion = source["serverVersion"];
	        this.latencyMs = source["latencyMs"];
	    }
	}
	export class ConstraintDto {
	    name: string;
	    quotedName: string;
	    type: string;
	    definition: string;
	    isLocal: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ConstraintDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.quotedName = source["quotedName"];
	        this.type = source["type"];
	        this.definition = source["definition"];
	        this.isLocal = source["isLocal"];
	    }
	}
	export class CreateDatabaseInputDto {
	    name: string;
	    owner: string;
	    ctype: string;
	    comment: string;
	    collate: string;
	    template: string;
	    encoding: string;
	    connectionLimit: number;
	
	    static createFrom(source: any = {}) {
	        return new CreateDatabaseInputDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.owner = source["owner"];
	        this.ctype = source["ctype"];
	        this.comment = source["comment"];
	        this.collate = source["collate"];
	        this.template = source["template"];
	        this.encoding = source["encoding"];
	        this.connectionLimit = source["connectionLimit"];
	    }
	}
	export class CreatePostgresConnectionInputDto {
	    alias?: string;
	    host: string;
	    port?: number;
	    database?: string;
	    username: string;
	    password?: string;
	    sslMode?: string;
	    clearPassword?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CreatePostgresConnectionInputDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.alias = source["alias"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.database = source["database"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.sslMode = source["sslMode"];
	        this.clearPassword = source["clearPassword"];
	    }
	}
	export class DiagramRelationDto {
	    name: string;
	    sourceTable: string;
	    targetTable: string;
	    sourceSchema: string;
	    targetSchema: string;
	    sourceColumns: string[];
	    targetColumns: string[];
	
	    static createFrom(source: any = {}) {
	        return new DiagramRelationDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.sourceTable = source["sourceTable"];
	        this.targetTable = source["targetTable"];
	        this.sourceSchema = source["sourceSchema"];
	        this.targetSchema = source["targetSchema"];
	        this.sourceColumns = source["sourceColumns"];
	        this.targetColumns = source["targetColumns"];
	    }
	}
	export class DiagramColumnDto {
	    name: string;
	    notNull: boolean;
	    isUnique: boolean;
	    dataType: string;
	    isPrimaryKey: boolean;
	    isForeignKey: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DiagramColumnDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.notNull = source["notNull"];
	        this.isUnique = source["isUnique"];
	        this.dataType = source["dataType"];
	        this.isPrimaryKey = source["isPrimaryKey"];
	        this.isForeignKey = source["isForeignKey"];
	    }
	}
	export class DiagramTableDto {
	    name: string;
	    kind: string;
	    schema: string;
	    comment?: string;
	    columns: DiagramColumnDto[];
	
	    static createFrom(source: any = {}) {
	        return new DiagramTableDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.kind = source["kind"];
	        this.schema = source["schema"];
	        this.comment = source["comment"];
	        this.columns = this.convertValues(source["columns"], DiagramColumnDto);
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
	export class DatabaseDiagramDto {
	    truncated: boolean;
	    tables: DiagramTableDto[];
	    relations: DiagramRelationDto[];
	
	    static createFrom(source: any = {}) {
	        return new DatabaseDiagramDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.truncated = source["truncated"];
	        this.tables = this.convertValues(source["tables"], DiagramTableDto);
	        this.relations = this.convertValues(source["relations"], DiagramRelationDto);
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
	export class DatabaseDto {
	    name: string;
	    owner: string;
	    encoding: string;
	    sizeBytes?: number;
	    allowConnect: boolean;
	    comment?: string;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.owner = source["owner"];
	        this.encoding = source["encoding"];
	        this.sizeBytes = source["sizeBytes"];
	        this.allowConnect = source["allowConnect"];
	        this.comment = source["comment"];
	    }
	}
	export class DatabaseOptionsDto {
	    roles: string[];
	    templates: string[];
	    currentUser: string;
	    defaultCtype: string;
	    defaultCollate: string;
	    defaultEncoding: string;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseOptionsDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.roles = source["roles"];
	        this.templates = source["templates"];
	        this.currentUser = source["currentUser"];
	        this.defaultCtype = source["defaultCtype"];
	        this.defaultCollate = source["defaultCollate"];
	        this.defaultEncoding = source["defaultEncoding"];
	    }
	}
	export class DatabaseStatDto {
	    name: string;
	    sizeBytes?: number;
	    connections: number;
	    xactCommit: number;
	    xactRollback: number;
	    blocksRead: number;
	    blocksHit: number;
	    tupReturned: number;
	    tupFetched: number;
	    tupInserted: number;
	    tupUpdated: number;
	    tupDeleted: number;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseStatDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.sizeBytes = source["sizeBytes"];
	        this.connections = source["connections"];
	        this.xactCommit = source["xactCommit"];
	        this.xactRollback = source["xactRollback"];
	        this.blocksRead = source["blocksRead"];
	        this.blocksHit = source["blocksHit"];
	        this.tupReturned = source["tupReturned"];
	        this.tupFetched = source["tupFetched"];
	        this.tupInserted = source["tupInserted"];
	        this.tupUpdated = source["tupUpdated"];
	        this.tupDeleted = source["tupDeleted"];
	    }
	}
	
	
	
	export class DropObjectInputDto {
	    kind: string;
	    name: string;
	    force: boolean;
	    schema: string;
	    cascade: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DropObjectInputDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.force = source["force"];
	        this.schema = source["schema"];
	        this.cascade = source["cascade"];
	    }
	}
	export class EditableTableDto {
	    name: string;
	    schema: string;
	    tableOid: number;
	    keyColumns: number[];
	    columnNumbers: number[];
	
	    static createFrom(source: any = {}) {
	        return new EditableTableDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.schema = source["schema"];
	        this.tableOid = source["tableOid"];
	        this.keyColumns = source["keyColumns"];
	        this.columnNumbers = source["columnNumbers"];
	    }
	}
	export class FunctionDto {
	    oid: number;
	    name: string;
	    arguments: string;
	    resultType: string;
	    kind: string;
	
	    static createFrom(source: any = {}) {
	        return new FunctionDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.oid = source["oid"];
	        this.name = source["name"];
	        this.arguments = source["arguments"];
	        this.resultType = source["resultType"];
	        this.kind = source["kind"];
	    }
	}
	export class IndexDto {
	    name: string;
	    quotedName: string;
	    definition: string;
	    isUnique: boolean;
	    isPrimary: boolean;
	    sizeBytes: number;
	    constraintBacked: boolean;
	
	    static createFrom(source: any = {}) {
	        return new IndexDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.quotedName = source["quotedName"];
	        this.definition = source["definition"];
	        this.isUnique = source["isUnique"];
	        this.isPrimary = source["isPrimary"];
	        this.sizeBytes = source["sizeBytes"];
	        this.constraintBacked = source["constraintBacked"];
	    }
	}
	export class ObjectReferenceDto {
	    kind: string;
	    schema: string;
	    name: string;
	    oid: number;
	
	    static createFrom(source: any = {}) {
	        return new ObjectReferenceDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.schema = source["schema"];
	        this.name = source["name"];
	        this.oid = source["oid"];
	    }
	}
	export class PostgresConnectionDto {
	    id: number;
	    alias: string;
	    host: string;
	    port: number;
	    database: string;
	    username: string;
	    sslMode: string;
	    hasPassword: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PostgresConnectionDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.alias = source["alias"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.database = source["database"];
	        this.username = source["username"];
	        this.sslMode = source["sslMode"];
	        this.hasPassword = source["hasPassword"];
	    }
	}
	export class QueryColumnDto {
	    name: string;
	    dataType: string;
	    typeOid: number;
	
	    static createFrom(source: any = {}) {
	        return new QueryColumnDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.dataType = source["dataType"];
	        this.typeOid = source["typeOid"];
	    }
	}
	export class QueryMessageDto {
	    severity: string;
	    code: string;
	    message: string;
	    detail: string;
	    hint: string;
	    where: string;
	    position: number;
	
	    static createFrom(source: any = {}) {
	        return new QueryMessageDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.severity = source["severity"];
	        this.code = source["code"];
	        this.message = source["message"];
	        this.detail = source["detail"];
	        this.hint = source["hint"];
	        this.where = source["where"];
	        this.position = source["position"];
	    }
	}
	export class QueryResultSetDto {
	    columns: QueryColumnDto[];
	    rows: string[][];
	    rowCount: number;
	    truncated: boolean;
	    commandTag: string;
	    rowsAffected: number;
	    editable?: EditableTableDto;
	
	    static createFrom(source: any = {}) {
	        return new QueryResultSetDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = this.convertValues(source["columns"], QueryColumnDto);
	        this.rows = source["rows"];
	        this.rowCount = source["rowCount"];
	        this.truncated = source["truncated"];
	        this.commandTag = source["commandTag"];
	        this.rowsAffected = source["rowsAffected"];
	        this.editable = this.convertValues(source["editable"], EditableTableDto);
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
	export class QueryExecutionDto {
	    resultSets: QueryResultSetDto[];
	    notices: QueryMessageDto[];
	    error?: QueryMessageDto;
	    durationMs: number;
	    txStatus: string;
	    reconnected: boolean;
	
	    static createFrom(source: any = {}) {
	        return new QueryExecutionDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.resultSets = this.convertValues(source["resultSets"], QueryResultSetDto);
	        this.notices = this.convertValues(source["notices"], QueryMessageDto);
	        this.error = this.convertValues(source["error"], QueryMessageDto);
	        this.durationMs = source["durationMs"];
	        this.txStatus = source["txStatus"];
	        this.reconnected = source["reconnected"];
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
	
	
	export class QuerySessionDto {
	    sessionId: string;
	    database: string;
	    serverVersion: string;
	    backendPid: number;
	
	    static createFrom(source: any = {}) {
	        return new QuerySessionDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.database = source["database"];
	        this.serverVersion = source["serverVersion"];
	        this.backendPid = source["backendPid"];
	    }
	}
	export class RelationDto {
	    name: string;
	    kind: string;
	    estimatedRows: number;
	    comment?: string;
	
	    static createFrom(source: any = {}) {
	        return new RelationDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.kind = source["kind"];
	        this.estimatedRows = source["estimatedRows"];
	        this.comment = source["comment"];
	    }
	}
	export class RowChangeDto {
	    key: CellValueDto[];
	    values: CellValueDto[];
	
	    static createFrom(source: any = {}) {
	        return new RowChangeDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = this.convertValues(source["key"], CellValueDto);
	        this.values = this.convertValues(source["values"], CellValueDto);
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
	export class SchemaDto {
	    name: string;
	    owner: string;
	    comment?: string;
	
	    static createFrom(source: any = {}) {
	        return new SchemaDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.owner = source["owner"];
	        this.comment = source["comment"];
	    }
	}
	export class SchemaObjectsDto {
	    tables: RelationDto[];
	    views: RelationDto[];
	    materializedViews: RelationDto[];
	    sequences: RelationDto[];
	    functions: FunctionDto[];
	
	    static createFrom(source: any = {}) {
	        return new SchemaObjectsDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tables = this.convertValues(source["tables"], RelationDto);
	        this.views = this.convertValues(source["views"], RelationDto);
	        this.materializedViews = this.convertValues(source["materializedViews"], RelationDto);
	        this.sequences = this.convertValues(source["sequences"], RelationDto);
	        this.functions = this.convertValues(source["functions"], FunctionDto);
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
	export class ServerSessionDto {
	    pid: number;
	    user?: string;
	    database?: string;
	    applicationName: string;
	    clientAddress?: string;
	    state?: string;
	    waitEvent?: string;
	    backendType?: string;
	    backendSeconds?: number;
	    transactionSeconds?: number;
	    querySeconds?: number;
	    query?: string;
	    isCurrent: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ServerSessionDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.user = source["user"];
	        this.database = source["database"];
	        this.applicationName = source["applicationName"];
	        this.clientAddress = source["clientAddress"];
	        this.state = source["state"];
	        this.waitEvent = source["waitEvent"];
	        this.backendType = source["backendType"];
	        this.backendSeconds = source["backendSeconds"];
	        this.transactionSeconds = source["transactionSeconds"];
	        this.querySeconds = source["querySeconds"];
	        this.query = source["query"];
	        this.isCurrent = source["isCurrent"];
	    }
	}
	export class ServerDashboardDto {
	    version: string;
	    serverVersion: string;
	    // Go type: time
	    startTime: any;
	    uptimeSeconds: number;
	    maxConnections: number;
	    currentUser: string;
	    isSuperuser: boolean;
	    inRecovery: boolean;
	    sampledAt: number;
	    databases: DatabaseStatDto[];
	    sessions: ServerSessionDto[];
	
	    static createFrom(source: any = {}) {
	        return new ServerDashboardDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.serverVersion = source["serverVersion"];
	        this.startTime = this.convertValues(source["startTime"], null);
	        this.uptimeSeconds = source["uptimeSeconds"];
	        this.maxConnections = source["maxConnections"];
	        this.currentUser = source["currentUser"];
	        this.isSuperuser = source["isSuperuser"];
	        this.inRecovery = source["inRecovery"];
	        this.sampledAt = source["sampledAt"];
	        this.databases = this.convertValues(source["databases"], DatabaseStatDto);
	        this.sessions = this.convertValues(source["sessions"], ServerSessionDto);
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
	
	export class SqlFileDto {
	    path: string;
	    name: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new SqlFileDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.content = source["content"];
	    }
	}
	export class TableChangesDto {
	    tableOid: number;
	    updates: RowChangeDto[];
	    deletes: RowChangeDto[];
	    inserts: RowChangeDto[];
	
	    static createFrom(source: any = {}) {
	        return new TableChangesDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tableOid = source["tableOid"];
	        this.updates = this.convertValues(source["updates"], RowChangeDto);
	        this.deletes = this.convertValues(source["deletes"], RowChangeDto);
	        this.inserts = this.convertValues(source["inserts"], RowChangeDto);
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
	export class TriggerDto {
	    name: string;
	    definition: string;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TriggerDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.definition = source["definition"];
	        this.enabled = source["enabled"];
	    }
	}
	export class TableDetailsDto {
	    schema: string;
	    name: string;
	    kind: string;
	    owner: string;
	    estimatedRows: number;
	    totalSizeBytes: number;
	    tableSizeBytes: number;
	    indexSizeBytes: number;
	    comment?: string;
	    columns: ColumnDto[];
	    indexes: IndexDto[];
	    constraints: ConstraintDto[];
	    triggers: TriggerDto[];
	    ddl: string;
	
	    static createFrom(source: any = {}) {
	        return new TableDetailsDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.schema = source["schema"];
	        this.name = source["name"];
	        this.kind = source["kind"];
	        this.owner = source["owner"];
	        this.estimatedRows = source["estimatedRows"];
	        this.totalSizeBytes = source["totalSizeBytes"];
	        this.tableSizeBytes = source["tableSizeBytes"];
	        this.indexSizeBytes = source["indexSizeBytes"];
	        this.comment = source["comment"];
	        this.columns = this.convertValues(source["columns"], ColumnDto);
	        this.indexes = this.convertValues(source["indexes"], IndexDto);
	        this.constraints = this.convertValues(source["constraints"], ConstraintDto);
	        this.triggers = this.convertValues(source["triggers"], TriggerDto);
	        this.ddl = source["ddl"];
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
	export class TableSaveResultDto {
	    updated: number;
	    deleted: number;
	    inserted: number;
	    committed: boolean;
	    txStatus: string;
	
	    static createFrom(source: any = {}) {
	        return new TableSaveResultDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.updated = source["updated"];
	        this.deleted = source["deleted"];
	        this.inserted = source["inserted"];
	        this.committed = source["committed"];
	        this.txStatus = source["txStatus"];
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

export namespace userDtos {
	
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

