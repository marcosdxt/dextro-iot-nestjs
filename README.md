# Dextro IoT - NestJS Module

Módulo NestJS dinâmico e agnóstico para integração de dispositivos IoT via protocolo MQTT (EMQX). Projetado para alta escalabilidade e concorrência (Shared Subscriptions).

## 🚀 Arquitetura do Protocolo

O componente utiliza o padrão **Mailbox RPC Pattern** para garantir entrega e desacoplamento:

1.  **RPC (Remote Procedure Call)**: Chamadas bidirecionais assíncronas via MQTT com Correlation IDs.
2.  **Inbox/Outbox**: Sistema de mensageria resiliente com deduplicação nativa e confirmação (ACK).
3.  **Segurança**: Autenticação mTLS (X.509) com Autoridade Certificadora (CA) interna integrada.

## 🛠️ Camadas e Componentes

- **`DextroIotModule`**: Módulo dinâmico que aceita provedores de persistência (Redis/Postgres) injetados.
- **`CertificateAuthorityService`**: Gerencia a raiz de confiança e emite certificados para dispositivos.
- **`MqttRouterService`**: Escaneia decoradores e roteia mensagens dinamicamente.
- **`OutboxProvider`**: Gerencia a fila de saída e notificações inteligentes para os dispositivos.

## 💻 Exemplo de Uso

### 1. Instalação e Configuração

```typescript
@Module({
  imports: [
    DextroIotModule.forRoot({
      deviceRepository: myDeviceRepo, // Implementa IDeviceRepository
      cacheProvider: myRedisCache,   // Implementa ICacheProvider
    }),
  ],
})
export class AppModule {}
```

### 2. Implementando Procedures e Handlers

```typescript
@Injectable()
export class LockerService {
  
  // O Device chama o Backend (Remote Procedure)
  @RemoteProcedure('get-config')
  async handleGetConfig(deviceId: string, payload: any) {
    return { interval: 30, version: '1.0.2' };
  }

  // O Device envia dados garantidos (Inbox)
  @InboxHandler('access-log')
  async handleAccessLog(deviceId: string, payload: any) {
    console.log(`Acesso no device ${deviceId}:`, payload);
  }
}
```

### 3. Chamando o Device (Outbox)

```typescript
@Injectable()
export class AdminService {
  constructor(private readonly outbox: OutboxProvider) {}

  async updateFirmware(deviceId: string) {
    await this.outbox.push(deviceId, 'OTA_NOTIFY', {
      url: 'https://s3.dextro.com/firmware.bin',
      hash: 'sha256...'
    });
  }
}
```

## 🧪 Testes

```bash
npm test
```
