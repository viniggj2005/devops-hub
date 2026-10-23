package cloudSyncDtos

type CloudSyncStatusDto struct {
	Connected      bool   `json:"connected"`
	Configured     bool   `json:"configured"`
	RemoteError    string `json:"remoteError"`
	AccountEmail   string `json:"accountEmail"`
	LastSyncedAt   string `json:"lastSyncedAt"`
	RemoteSyncedAt string `json:"remoteSyncedAt"`
	RestorePending bool   `json:"restorePending"`
}
