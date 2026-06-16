import { Test, TestingModule } from '@nestjs/testing';
import { OutboxProvider, OutboxMessage } from './outbox.provider';
import { ICacheProvider, IDeviceRepository } from '../interfaces/persistence.interface';
import { DEXTRO_IOT_OPTIONS } from '../constants/iot.constants';

describe('OutboxProvider', () => {
    let provider: OutboxProvider;
    let cache: jest.Mocked<ICacheProvider>;
    let repository: jest.Mocked<IDeviceRepository>;

    beforeEach(async () => {
        cache = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        } as any;

        repository = {
            findOne: jest.fn().mockResolvedValue({ id: 'DEV-1' }),
            save: jest.fn(),
            updateStatus: jest.fn(),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OutboxProvider,
                { provide: 'ICacheProvider', useValue: cache },
                { provide: 'IDeviceRepository', useValue: repository },
                { provide: DEXTRO_IOT_OPTIONS, useValue: {} },
            ],
        }).compile();

        provider = module.get<OutboxProvider>(OutboxProvider);
    });

    it('deve rejeitar o push se o dispositivo não existir', async () => {
        repository.findOne.mockResolvedValueOnce(null);
        await expect(provider.push('DEV-INVALID', 'TEST', {})).rejects.toThrow('DeviceNotFoundError');
    });

    it('deve enfileirar mensagem e notificar device se não houver lock', async () => {
        cache.get.mockResolvedValue(null); // Sem fila previa e sem lock
        
        const deviceId = 'DEV-1';
        const msgId = await provider.push(deviceId, 'TEST_TYPE', { data: 123 });

        expect(msgId).toBeDefined();
        expect(cache.set).toHaveBeenCalledWith(
            `dextro-iot:outbox:${deviceId}`,
            expect.stringContaining('TEST_TYPE'),
            expect.any(Number)
        );
        // Verifica lock de notificação
        expect(cache.set).toHaveBeenCalledWith(
            `dextro-iot:notify-lock:${deviceId}`,
            '1',
            60
        );
    });

    it('deve suprimir notificação se houver lock ativo', async () => {
        cache.get.mockImplementation(async (key) => {
            if (key.includes('notify-lock')) return '1';
            return null;
        });

        const deviceId = 'DEV-1';
        await provider.push(deviceId, 'TEST_TYPE', {});

        // Não deve setar o lock novamente (supressão)
        // O primeiro set na verdade não acontece pq o get já retornou '1'
        // Vamos verificar se o count de chamadas do set de lock é zero
        const lockSets = cache.set.mock.calls.filter(call => call[0].includes('notify-lock'));
        expect(lockSets.length).toBe(0);
    });

    it('deve limpar lock no pull', async () => {
        cache.get.mockResolvedValue(JSON.stringify([{ id: '1', type: 'T', payload: {} }]));
        
        const deviceId = 'DEV-1';
        await provider.pull(deviceId);

        expect(cache.del).toHaveBeenCalledWith(`dextro-iot:notify-lock:${deviceId}`);
    });

    it('deve remover item no ack', async () => {
        const msg: OutboxMessage = { id: 'msg-123', type: 'T', payload: {} };
        cache.get.mockResolvedValue(JSON.stringify([msg]));
        
        await provider.ack('DEV-1', 'msg-123');

        expect(cache.del).toHaveBeenCalledWith('dextro-iot:outbox:DEV-1');
    });
});
