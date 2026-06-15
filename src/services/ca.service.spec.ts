import { Test, TestingModule } from '@nestjs/testing';
import { CertificateAuthorityService } from '../services/ca.service';
import * as forge from 'node-forge';

describe('CertificateAuthorityService', () => {
    let service: CertificateAuthorityService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CertificateAuthorityService],
        }).compile();

        service = module.get<CertificateAuthorityService>(CertificateAuthorityService);
    });

    it('deve ser definido', () => {
        expect(service).toBeDefined();
    });

    it('deve criar uma Root CA válida', async () => {
        const ca = await service.createRootCA('Dextro Test Root CA');
        
        expect(ca.certificate).toContain('BEGIN CERTIFICATE');
        expect(ca.privateKey).toContain('BEGIN RSA PRIVATE KEY');

        const cert = forge.pki.certificateFromPem(ca.certificate);
        expect(cert.subject.getField('CN').value).toBe('Dextro Test Root CA');
        expect(cert.issuer.getField('CN').value).toBe('Dextro Test Root CA'); // Auto-assinado
    });

    it('deve gerar um certificado de dispositivo assinado pela CA', async () => {
        const ca = await service.createRootCA();
        const deviceId = 'DEVICE-001';
        
        const deviceCert = await service.generateDeviceCertificate(
            deviceId,
            ca.certificate,
            ca.privateKey
        );

        expect(deviceCert.certificate).toContain('BEGIN CERTIFICATE');
        
        const cert = forge.pki.certificateFromPem(deviceCert.certificate);
        const caCert = forge.pki.certificateFromPem(ca.certificate);

        expect(cert.subject.getField('CN').value).toBe(deviceId);
        expect(cert.issuer.getField('CN').value).toBe(caCert.subject.getField('CN').value);

        // Verifica carregamento ok
        expect(cert).toBeDefined();
        expect(cert.signature).toBeDefined();
    });
});
