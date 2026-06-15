import { Test, TestingModule } from '@nestjs/testing';
import { DextroIotModule } from './iot.module';
import { CertificateAuthorityService } from './services/ca.service';
import { OutboxProvider } from './providers/outbox.provider';
import { MqttRouterService } from './services/mqtt-router.service';
import { ICacheProvider, IDeviceRepository } from './interfaces/persistence.interface';
import { DiscoveryModule } from '@nestjs/core';

describe('DextroIotModule (Integration)', () => {
    let module: TestingModule;
    let cache: jest.Mocked<ICacheProvider>;
    let repository: jest.Mocked<IDeviceRepository>;

    beforeEach(async () => {
        cache = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        } as any;

        repository = {
            findOne: jest.fn(),
            save: jest.fn(),
            updateStatus: jest.fn(),
        } as any;

        module = await Test.createTestingModule({
            imports: [
                DiscoveryModule,
                DextroIotModule.forRoot({
                    deviceRepository: repository,
                    cacheProvider: cache,
                }),
            ],
        }).compile();
    });

    it('deve carregar todos os serviços corretamente via forRoot', () => {
        const caService = module.get<CertificateAuthorityService>(CertificateAuthorityService);
        const outboxProvider = module.get<OutboxProvider>(OutboxProvider);
        const mqttRouter = module.get<MqttRouterService>(MqttRouterService);

        expect(caService).toBeDefined();
        expect(outboxProvider).toBeDefined();
        expect(mqttRouter).toBeDefined();
    });

    it('deve injetar os providers de persistência corretamente', () => {
        const outboxProvider = module.get<OutboxProvider>(OutboxProvider);
        expect(outboxProvider['cache']).toBe(cache);
        expect(outboxProvider['repository']).toBe(repository);
    });
});
