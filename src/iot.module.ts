import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DEXTRO_IOT_OPTIONS } from './constants/iot.constants';
import { DextroIotModuleOptions, DextroIotAsyncOptions, DextroIotOptionsFactory } from './interfaces/iot-options.interface';
import { CertificateAuthorityService } from './services/ca.service';
import { MqttRouterService } from './services/mqtt-router.service';
import { OutboxProvider } from './providers/outbox.provider';

@Global()
@Module({
  imports: [DiscoveryModule],
})
export class DextroIotModule {
  static forRoot(options: DextroIotModuleOptions): DynamicModule {
    return {
      module: DextroIotModule,
      providers: [
        {
          provide: DEXTRO_IOT_OPTIONS,
          useValue: options,
        },
        CertificateAuthorityService,
        MqttRouterService,
        OutboxProvider,
        ...this.createAppProviders(options),
      ],
      exports: [CertificateAuthorityService, MqttRouterService, OutboxProvider],
    };
  }

  static forRootAsync(options: DextroIotAsyncOptions): DynamicModule {
    return {
      module: DextroIotModule,
      imports: [...(options.imports || []), DiscoveryModule],
      providers: [
        this.createAsyncOptionsProvider(options),
        CertificateAuthorityService,
        MqttRouterService,
        OutboxProvider,
        ...(options.extraProviders || []),
      ],
      exports: [CertificateAuthorityService, MqttRouterService, OutboxProvider],
    };
  }

  private static createAsyncOptionsProvider(options: DextroIotAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: DEXTRO_IOT_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: DEXTRO_IOT_OPTIONS,
      useFactory: async (optionsFactory: DextroIotOptionsFactory) =>
        await optionsFactory.createIotOptions(),
      inject: [options.useExisting || options.useClass],
    };
  }

  private static createAppProviders(options: DextroIotModuleOptions): Provider[] {
    return [
      {
        provide: 'IDeviceRepository',
        useValue: options.deviceRepository,
      },
      {
        provide: 'ICacheProvider',
        useValue: options.cacheProvider,
      },
    ];
  }
}
