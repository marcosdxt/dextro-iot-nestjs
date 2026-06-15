import { Injectable, Logger } from '@nestjs/common';
import * as forge from 'node-forge';

export interface GeneratedCertificate {
    certificate: string;
    privateKey: string;
    caCertificate?: string;
}

@Injectable()
export class CertificateAuthorityService {
    private readonly logger = new Logger(CertificateAuthorityService.name);

    /**
     * Gera um par de chaves e um certificado assinado para um dispositivo.
     * @param deviceId ID único do dispositivo
     * @param caCertPEM Certificado da CA (opcional se for auto-assinado)
     * @param caKeyPEM Chave privada da CA
     */
    async generateDeviceCertificate(
        deviceId: string,
        caCertPEM: string,
        caKeyPEM: string,
        daysValid: number = 3650
    ): Promise<GeneratedCertificate> {
        this.logger.log(`Gerando certificado para o dispositivo: ${deviceId}`);

        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();

        cert.publicKey = keys.publicKey;
        cert.serialNumber = this.generateSerialNumber();
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + daysValid);

        const attrs = [{
            name: 'commonName',
            value: deviceId
        }, {
            name: 'organizationName',
            value: 'Dextro IoT'
        }];

        cert.setSubject(attrs);

        // Parse CA
        const caCert = forge.pki.certificateFromPem(caCertPEM);
        const caKey = forge.pki.privateKeyFromPem(caKeyPEM);
        
        cert.setIssuer(caCert.subject.attributes);

        // Assina com a chave da CA
        cert.sign(caKey, forge.md.sha256.create());

        return {
            certificate: forge.pki.certificateToPem(cert),
            privateKey: forge.pki.privateKeyToPem(keys.privateKey),
            caCertificate: caCertPEM
        };
    }

    private generateSerialNumber(): string {
        return Math.floor(Math.random() * 100000).toString();
    }

    /**
     * Utilitário para criar uma CA do zero (Root CA)
     */
    async createRootCA(organization: string = 'Dextro IoT Root CA'): Promise<GeneratedCertificate> {
        const keys = forge.pki.rsa.generateKeyPair(4096);
        const cert = forge.pki.createCertificate();

        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 20);

        const attrs = [{
            name: 'commonName',
            value: organization
        }];

        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        cert.setExtensions([{
            name: 'basicConstraints',
            cA: true
        }, {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
        }]);

        cert.sign(keys.privateKey, forge.md.sha256.create());

        return {
            certificate: forge.pki.certificateToPem(cert),
            privateKey: forge.pki.privateKeyToPem(keys.privateKey)
        };
    }
}
