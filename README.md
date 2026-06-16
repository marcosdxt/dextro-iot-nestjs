<div align="center">
  <h1>🚀 Dextro IoT - NestJS Module</h1>
  <p><b>O motor de conectividade IoT agnóstico, escalável e seguro para aplicações NestJS.</b></p>
</div>

---

## 📖 A Filosofia Dextro IoT

Construir conectividade IoT em larga escala geralmente envolve "amarrar" frameworks complexos (como AWS IoT ou Azure IoT) e lidar com milhares de regras de roteamento manual. O **Dextro IoT** foi criado para resolver esse problema trazendo a experiência de desenvolvimento de um *Microserviço* para o hardware.

Ele transforma dispositivos físicos em **Atores Remotos** que sua aplicação NestJS pode chamar ou receber mensagens de forma **tipada**, **garantida** e **desacoplada**.

### Por que usar este módulo?
1. **Zero Lock-in de Infraestrutura**: Ele exige interfaces genéricas (`ICacheProvider`, `IDeviceRepository`). Você pode usar seu próprio Postgres, MongoDB ou Redis.
2. **Escalabilidade "Day One"**: Utiliza *Shared Subscriptions* do EMQX. Você pode subir de 1 para 500 pods do seu backend e as mensagens serão balanceadas automaticamente sem duplicação.
3. **Identity & mTLS Internos**: Você não precisa assinar um serviço de CA caro. O módulo atua como sua própria Autoridade Certificadora gerando certificados X.509 para a frota.

---

## 🏗️ Os 3 Pilares da Arquitetura (O Protocolo)

A biblioteca não confia no hardware. Ela abstrai a complexidade do protocolo MQTT e expõe três intenções claras para o desenvolvedor da aplicação:

### 1. ⚡ Remote / Device Procedures (O "Agora")
Usado para ações síncronas (ex: *"Abra a tranca 2"*, *"Qual a sua temperatura atual?"*).
O componente cuida da correlação de UUIDs para garantir que, num cluster com dezenas de pods NestJS, a resposta do hardware chegue exclusivamente ao pod que originou a requisição.

### 2. 📬 The Mailbox Pattern (O "Garantido")
Esqueça o QoS 2 do MQTT que consome banda. Usamos um padrão de **Inbox / Outbox**:
- **Inbox**: O device "puxa" os dados para o backend com um ID único. O backend deduplica a mensagem e só então aciona sua regra de negócio.
- **Outbox**: Você joga arquivos/configurações na "caixa de saída". O backend "pinga" o device. Se a rede cair, não tem problema; o device fará o pull quando voltar.

### 3. 🛡️ Contexto Rico Injetado
Seu código não fica poluído fazendo requisições ao banco de dados para saber "quem é esse device". O `MqttRouterService` resolve a identidade, puxa o cache do Redis e injeta os metadados diretamente no seu Handler.

---

## 💻 Como Usar: Do Zero ao "Hello Device"

### Passo 1: Instalação e Configuração

Na raiz do seu projeto NestJS, inicialize o módulo fornecendo as interfaces de persistência que você já usa no seu projeto.

```typescript
import { Module } from '@nestjs/common';
import { DextroIotModule } from 'dextro-iot-nestjs';
import { MyPostgresRepo, MyRedisCache } from './infra';

@Module({
  imports: [
    DextroIotModule.forRootAsync({
      useFactory: (dbRepo: MyPostgresRepo, redisCache: MyRedisCache) => ({
        deviceRepository: dbRepo, // Onde o componente buscará os metadados do device
        cacheProvider: redisCache // Onde o componente fará a deduplicação e controle de lock
      }),
      inject: [MyPostgresRepo, MyRedisCache],
    }),
  ],
})
export class AppModule {}
```

### Passo 2: Recebendo Comandos (RPC) de forma Tipada

Para permitir que os dispositivos chamem a sua nuvem, basta decorar os métodos do seu Service. O componente cuidará do roteamento e da injeção do contexto.

```typescript
import { Injectable } from '@nestjs/common';
import { DextroIotMeta, RemoteProcedure, InboxHandler } from 'dextro-iot-nestjs';

// Defina seus DTOs para tipagem estrita
class ConfigRequestDto { version: string; }
class TelemetryDto { battery: number; tamper: boolean; }

// Interface base que o componente irá injetar em você
interface RpcContext<T> {
  deviceId: string;
  payload: T;
  metadata: DextroIotMeta; // O objeto do device resolvido no DB/Cache!
}

@Injectable()
export class DeviceControllerService {
  
  /**
   * O device chama isso para saber o que fazer.
   * Ex: Dispositivo recém ligado pedindo configurações de rede.
   */
  @RemoteProcedure('get-config')
  async handleGetConfig({ deviceId, payload, metadata }: RpcContext<ConfigRequestDto>) {
    console.log(`Device ID: ${deviceId} (Hardware: ${metadata.hardwareVersion})`);
    
    // A resposta é serializada e enviada de volta ao device que a solicitou
    return { 
      interval: metadata.isPremium ? 10 : 30, 
      status: 'active' 
    };
  }

  /**
   * O device envia dados que NÃO PODEM ser perdidos nem duplicados.
   * O DextroIotModule garante que isso só será chamado 1 vez por 'msg_id'.
   */
  @InboxHandler('telemetry-critical')
  async handleTelemetry({ deviceId, payload }: RpcContext<TelemetryDto>) {
    if (payload.tamper) {
      await this.triggerAlarm(deviceId);
    }
  }
}
```

### Passo 3: Enviando Dados Garantidos ao Dispositivo (Outbox)

Você quer atualizar a configuração de um dispositivo que pode estar offline no momento? Não use MQTT Publish direto. Use a **Outbox**.

```typescript
import { Injectable } from '@nestjs/common';
import { OutboxProvider } from 'dextro-iot-nestjs';

@Injectable()
export class AdminService {
  constructor(private readonly outbox: OutboxProvider) {}

  async updateDeviceAccessList(deviceId: string) {
    const newUsers = await this.getUsersFromDb();

    // 1. O componente salva isso no cache.
    // 2. Se o device estiver online, ele recebe um "PING" (outbox-notify).
    // 3. Se estiver offline, ele fará o pull das pendências assim que ligar.
    await this.outbox.push(deviceId, 'UPDATE_ACCESS_LIST', {
      users: newUsers,
      timestamp: Date.now()
    });
  }
}
```

---

## 🔒 Gerando Certificados e Provisionamento (mTLS)

O módulo inclui a `CertificateAuthorityService`. Você pode usá-la no seu endpoint de provisionamento (ex: quando um técnico escaneia o QR Code do equipamento para ativá-lo).

```typescript
import { CertificateAuthorityService } from 'dextro-iot-nestjs';

@Injectable()
export class ProvisioningService {
  constructor(private readonly caService: CertificateAuthorityService) {}

  async provisionNewHardware(macAddress: string) {
    // Busca a chave da CA na variável de ambiente (ou AWS KMS/Vault)
    const rootCaPem = process.env.ROOT_CA_PEM;
    const rootKeyPem = process.env.ROOT_KEY_PEM;

    // Gera um certificado assinado exclusivo para este MAC Address
    const deviceIdentity = await this.caService.generateDeviceCertificate(
      macAddress, 
      rootCaPem, 
      rootKeyPem,
      3650 // Válido por 10 anos
    );

    // Salva no banco e devolve para o hardware via HTTPs no boot inicial
    return {
      certificate: deviceIdentity.certificate,
      privateKey: deviceIdentity.privateKey
    };
  }
}
```

## ⚙️ Variáveis de Ambiente Recomendadas
Embora o módulo seja flexível, ele espera se conectar a um Broker MQTT (como o EMQX).

```env
DEXTRO_IOT_BROKER_URL=mqtt://emqx-cluster.internal:1883
DEXTRO_IOT_CLIENT_ID=nestjs-core-pod-01
```

---
*Dextro IoT - Elevando o hardware ao estado da arte.*
