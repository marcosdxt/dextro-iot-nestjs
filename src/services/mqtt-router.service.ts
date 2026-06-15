import { Injectable, OnModuleInit, Logger, Type } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { 
    IOT_REMOTE_PROCEDURE_METADATA, 
    IOT_INBOX_HANDLER_METADATA 
} from '../constants/iot.constants';

export interface IotHandlerMetadata {
    type: string;
    methodName: string;
    instance: any;
}

@Injectable()
export class MqttRouterService implements OnModuleInit {
    private readonly logger = new Logger(MqttRouterService.name);
    
    private remoteProcedures = new Map<string, IotHandlerMetadata>();
    private inboxHandlers = new Map<string, IotHandlerMetadata>();

    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly metadataScanner: MetadataScanner,
        private readonly reflector: Reflector,
    ) {}

    onModuleInit() {
        this.exploreHandlers();
    }

    private exploreHandlers() {
        const providers = this.discoveryService.getProviders();

        providers.forEach((wrapper) => {
            const { instance } = wrapper;
            if (!instance) return;

            const prototype = Object.getPrototypeOf(instance);
            this.metadataScanner.scanFromPrototype(
                instance,
                prototype,
                (methodName: string) => {
                    const callback = instance[methodName];
                    
                    // Explore Remote Procedures
                    const rpType = this.reflector.get<string>(IOT_REMOTE_PROCEDURE_METADATA, callback);
                    if (rpType) {
                        this.remoteProcedures.set(rpType, { type: rpType, methodName, instance });
                        this.logger.log(`Registrado RemoteProcedure: [${rpType}] -> ${instance.constructor.name}.${methodName}`);
                    }

                    // Explore Inbox Handlers
                    const inboxType = this.reflector.get<string>(IOT_INBOX_HANDLER_METADATA, callback);
                    if (inboxType) {
                        this.inboxHandlers.set(inboxType, { type: inboxType, methodName, instance });
                        this.logger.log(`Registrado InboxHandler: [${inboxType}] -> ${instance.constructor.name}.${methodName}`);
                    }
                },
            );
        });
    }

    /**
     * Roteia uma chamada MQTT para o handler correspondente.
     */
    async routeRemoteProcedure(type: string, deviceId: string, payload: any): Promise<any> {
        const handler = this.remoteProcedures.get(type);
        if (!handler) {
            this.logger.warn(`Nenhum handler registrado para RemoteProcedure: ${type}`);
            return { error: 'PROCEDURE_NOT_FOUND' };
        }

        return await handler.instance[handler.methodName](deviceId, payload);
    }

    async routeInboxMessage(type: string, deviceId: string, payload: any): Promise<void> {
        const handler = this.inboxHandlers.get(type);
        if (!handler) {
            this.logger.warn(`Nenhum handler registrado para InboxHandler: ${type}`);
            return;
        }

        await handler.instance[handler.methodName](deviceId, payload);
    }
}
