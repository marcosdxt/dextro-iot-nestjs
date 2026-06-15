import { IDeviceRepository, ICacheProvider } from './persistence.interface';

export interface DextroIotModuleOptions {
  url?: string;
  port?: number;
  username?: string;
  password?: string;
  clientId?: string;
  deviceRepository: IDeviceRepository;
  cacheProvider: ICacheProvider;
}

export interface DextroIotOptionsFactory {
  createIotOptions(): Promise<DextroIotModuleOptions> | DextroIotModuleOptions;
}

export interface DextroIotAsyncOptions {
  imports?: any[];
  useExisting?: any;
  useClass?: any;
  useFactory?: (...args: any[]) => Promise<DextroIotModuleOptions> | DextroIotModuleOptions;
  inject?: any[];
  extraProviders?: any[];
}
