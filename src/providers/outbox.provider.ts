import { Inject, Injectable, Logger } from '@nestjs/common';
import { ICacheProvider, IDeviceRepository } from '../interfaces/persistence.interface';
import { DEXTRO_IOT_OPTIONS } from '../constants/iot.constants';
import { DextroIotModuleOptions } from '../interfaces/iot-options.interface';
import { v4 as uuidv4 } from 'uuid';

export interface OutboxMessage<T = any> {
    id: string;
    type: string;
    payload: T;
}

@Injectable()
export class OutboxProvider {
    private readonly logger = new Logger(OutboxProvider.name);

    constructor(
        @Inject('ICacheProvider') private readonly cache: ICacheProvider,
        @Inject('IDeviceRepository') private readonly repository: IDeviceRepository,
        @Inject(DEXTRO_IOT_OPTIONS) private readonly options: DextroIotModuleOptions,
    ) {}

    /**
     * Enfileira uma mensagem para o dispositivo e notifica-o.
     */
    async push(deviceId: string, type: string, payload: any): Promise<string> {
        const id = uuidv4();
        const message: OutboxMessage = { id, type, payload };

        this.logger.log(`Enfileirando mensagem Outbox [${type}] para ${deviceId}`);

        // 1. Persistência (Usa o Cache Provider para a fila rápida de entrega)
        // Em um sistema real, poderíamos salvar no Postgres via repository também
        const outboxKey = `dextro-iot:outbox:${deviceId}`;
        const currentQueue = await this.getQueue(deviceId);
        currentQueue.push(message);
        
        await this.cache.set(outboxKey, JSON.stringify(currentQueue), 3600 * 24); // 24h TTL

        // 2. Notificação Inteligente (Suprime se já houver notificação pendente)
        await this.notifyDevice(deviceId);

        return id;
    }

    private async getQueue(deviceId: string): Promise<OutboxMessage[]> {
        const data = await this.cache.get(`dextro-iot:outbox:${deviceId}`);
        return data ? JSON.parse(data) : [];
    }

    private async notifyDevice(deviceId: string) {
        const notifyLockKey = `dextro-iot:notify-lock:${deviceId}`;
        const hasLock = await this.cache.get(notifyLockKey);

        if (hasLock) {
            this.logger.debug(`Notificação suprimida para ${deviceId} (já existe pendente)`);
            return;
        }

        // Marca que uma notificação foi enviada
        await this.cache.set(notifyLockKey, '1', 60); // Lock de 60s ou até o Pull

        // TODO: Aqui chamamos o MqttClient para enviar o RPC 'outbox-notify'
        this.logger.log(`Disparando outbox-notify RPC para ${deviceId}`);
        // this.mqttClient.sendDeviceProcedure(deviceId, 'outbox-notify', {});
    }

    /**
     * Chamado pelo MqttRouter quando o device faz 'outbox-pull'
     */
    async pull(deviceId: string): Promise<OutboxMessage[]> {
        const queue = await this.getQueue(deviceId);
        
        // Ao fazer pull, liberamos o lock de notificação para que novos pushes gerem novos pings
        await this.cache.del(`dextro-iot:notify-lock:${deviceId}`);
        
        return queue;
    }

    /**
     * Chamado pelo MqttRouter quando o device faz 'outbox-ack'
     */
    async ack(deviceId: string, messageId: string): Promise<void> {
        let queue = await this.getQueue(deviceId);
        queue = queue.filter(m => m.id !== messageId);
        
        if (queue.length === 0) {
            await this.cache.del(`dextro-iot:outbox:${deviceId}`);
        } else {
            await this.cache.set(`dextro-iot:outbox:${deviceId}`, JSON.stringify(queue), 3600 * 24);
        }
        
        this.logger.debug(`Mensagem ${messageId} confirmada (ACK) por ${deviceId}`);
    }
}
