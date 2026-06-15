import { Test, TestingModule } from '@nestjs/testing';
import { MqttRouterService } from '../services/mqtt-router.service';
import { RemoteProcedure, InboxHandler } from '../decorators/iot.decorators';
import { DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';

class MockAppService {
    @RemoteProcedure('get-status')
    async getStatus(deviceId: string, payload: any) {
        return { status: 'OK', deviceId };
    }

    @InboxHandler('telemetry')
    async handleTelemetry(deviceId: string, payload: any) {
        return { processed: true };
    }
}

describe('MqttRouterService', () => {
    let service: MqttRouterService;
    let appService: MockAppService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [DiscoveryModule],
            providers: [
                MqttRouterService,
                MetadataScanner,
                MockAppService
            ],
        }).compile();

        service = module.get<MqttRouterService>(MqttRouterService);
        appService = module.get<MockAppService>(MockAppService);
        
        // Simula o lifecycle do NestJS para o Discovery funcionar
        service.onModuleInit();
    });

    it('deve descobrir e rotear RemoteProcedures decorados', async () => {
        const result = await service.routeRemoteProcedure('get-status', 'DEV-123', { foo: 'bar' });
        expect(result).toEqual({ status: 'OK', deviceId: 'DEV-123' });
    });

    it('deve descobrir e rotear InboxHandlers decorados', async () => {
        const spy = jest.spyOn(appService, 'handleTelemetry');
        await service.routeInboxMessage('telemetry', 'DEV-123', { temp: 25 });
        expect(spy).toHaveBeenCalledWith('DEV-123', { temp: 25 });
    });

    it('deve retornar erro para procedimento não encontrado', async () => {
        const result = await service.routeRemoteProcedure('unknown', 'DEV-123', {});
        expect(result).toEqual({ error: 'PROCEDURE_NOT_FOUND' });
    });
});
