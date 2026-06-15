import { Test, TestingModule } from '@nestjs/testing';
import { DextroIotModule } from './iot.module';
import { OutboxProvider } from './providers/outbox.provider';
import { ICacheProvider, IDeviceRepository } from './interfaces/persistence.interface';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DiscoveryModule } from '@nestjs/core';

describe('DextroIotModule (E2E TestContainers)', () => {
    let redisContainer: StartedRedisContainer;
    let postgresContainer: StartedPostgreSqlContainer;
    let module: TestingModule;
    let outbox: OutboxProvider;

    // Aumentamos o timeout para o TestContainers subir as imagens
    jest.setTimeout(60000);

    beforeAll(async () => {
        redisContainer = await new RedisContainer('redis:6.2-alpine').start();
        postgresContainer = await new PostgreSqlContainer('postgres:15-alpine').start();
    });

    afterAll(async () => {
        await redisContainer.stop();
        await postgresContainer.stop();
    });

    beforeEach(async () => {
        // Implementações reais simplificadas para o teste
        const cacheProvider: ICacheProvider = {
            async get(key) { return null; }, // Mock simplificado
            async set(key, val) {},
            async del(key) {}
        };

        const deviceRepo: IDeviceRepository = {
            async findOne(id) { return null; },
            async save(id, data) {},
            async updateStatus(id, online) {}
        };

        module = await Test.createTestingModule({
            imports: [
                DiscoveryModule,
                DextroIotModule.forRoot({
                    deviceRepository: deviceRepo,
                    cacheProvider: cacheProvider,
                }),
            ],
        }).compile();

        outbox = module.get<OutboxProvider>(OutboxProvider);
    });

    it('deve subir os containers e injetar o provider corretamente', async () => {
        expect(outbox).toBeDefined();
        expect(redisContainer.getMappedPort(6379)).toBeDefined();
        expect(postgresContainer.getMappedPort(5432)).toBeDefined();
    });
});
