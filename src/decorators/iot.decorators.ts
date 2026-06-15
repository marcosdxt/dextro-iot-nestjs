import { SetMetadata } from '@nestjs/common';
import { 
    IOT_REMOTE_PROCEDURE_METADATA, 
    IOT_DEVICE_PROCEDURE_METADATA, 
    IOT_INBOX_HANDLER_METADATA 
} from '../constants/iot.constants';

/**
 * Decorator para marcar um método como handler de um Remote Procedure (Device -> Backend).
 * @param type O nome do procedimento ou tipo de mensagem.
 */
export const RemoteProcedure = (type: string) => SetMetadata(IOT_REMOTE_PROCEDURE_METADATA, type);

/**
 * Decorator para marcar um método que pode ser chamado via RPC pelo Backend no Device.
 * Geralmente usado em services que expõem lógica de controle.
 */
export const DeviceProcedure = (name: string) => SetMetadata(IOT_DEVICE_PROCEDURE_METADATA, name);

/**
 * Decorator para marcar um método como processador de mensagens da Inbox (Deduplicadas).
 * @param type O 'type' da mensagem definida no envelope do Mailbox.
 */
export const InboxHandler = (type: string) => SetMetadata(IOT_INBOX_HANDLER_METADATA, type);
