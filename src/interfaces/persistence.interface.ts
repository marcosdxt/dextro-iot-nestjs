export interface IDeviceRepository {
    findOne(deviceId: string): Promise<any>;
    save(deviceId: string, metadata: any): Promise<void>;
    updateStatus(deviceId: string, online: boolean): Promise<void>;
}

export interface ICacheProvider {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
}
