import { Resource, Fn } from 'cdktf';
import { Construct } from 'constructs';

import { AcmCertificate, AcmCertificateValidation } from '../gen/providers/aws/acm';
import { DataAwsRoute53Zone, Route53Record } from '../gen/providers/aws/route53';

import { getRootDomainFromUrl } from '../lib/util';
import commonConfig from '../config/common.json';

interface Options {
  ghostHostingUrl: string;
}

interface Response {
  certificateArn: string;
}

/**
 * @dev Class to create ACM certificate and attach it to the domain provided
 */
class AcmResource extends Resource {
  options: Options;

  /**
   * @dev Constructor for the ACM certificate resource class
   *
   * @param scope - scope in which to define this construct
   * @param name - name of the resource
   * @param options - options required by the resource
   */
  constructor(scope: Construct, name: string, options: Options) {
    super(scope, name);

    this.options = options;
  }

  /**
   * @dev Main performer of the class
   * 
   * @returns { Response }
   */
  perform(): Response {
    const rootDomain = getRootDomainFromUrl(this.options.ghostHostingUrl) || '';

    const cert = this._createCertificate(rootDomain);

    const route53Zone = this._getRoute53Zone(rootDomain);

    const fqdns = this._createRoute53Record(route53Zone, cert);

    this._validateAcmCertificate(cert, fqdns);

    return { certificateArn: cert.arn };
  }

  /**
   * @dev Create certificate for the provided domain
   * 
   * @param ghostHostingDomain
   * @returns { AcmCertificate }
   */
  _createCertificate(ghostHostingDomain: string): AcmCertificate {
    return new AcmCertificate(this, 'cert', {
      domainName: ghostHostingDomain,
      subjectAlternativeNames: [`*.${ghostHostingDomain}`],
      validationMethod: 'DNS',
      tags: commonConfig.tags,
      lifecycle: {
        createBeforeDestroy: false,
      },
    });
  }

  /**
   * @dev Get Route53 zone for the domain provided
   * 
   * @param ghostHostingDomain
   * @returns { DataAwsRoute53Zone }
   */
  _getRoute53Zone(ghostHostingDomain: string): DataAwsRoute53Zone {
    return new DataAwsRoute53Zone(this, 'route53_zone', {
      name: ghostHostingDomain
    });
  }

  /**
   * @dev Create Route53 record
   * 
   * @param route53Zone
   * @param cert
   * @returns { string[] } - collected fqdns
   */
  _createRoute53Record(route53Zone: DataAwsRoute53Zone, cert: AcmCertificate): string[] {
    const fqdns = [];

    const domainValidationOptions = cert.domainValidationOptions;
    for (let index = 0; index < Fn.tolist(domainValidationOptions).length; index++) {
      const identifier = 'domain_validation_record_' + index;
      const record = new Route53Record(this, identifier, {
        name: domainValidationOptions.get(index).resourceRecordName,
        type: domainValidationOptions.get(index).resourceRecordType,
        records: [domainValidationOptions.get(index).resourceRecordValue],
        allowOverwrite: true,
        ttl: 60,
        zoneId: route53Zone.id
      });

      fqdns.push(record.fqdn);
    }

    return fqdns;
  }

  /**
   * @dev Validate ACM certificate created for the domain
   * 
   * @param cert
   * @param fqdns
   * @returns { void }
   */
  _validateAcmCertificate(cert: AcmCertificate, fqdns: string[]): void {
    new AcmCertificateValidation(this, 'cert_validation', {
      certificateArn: cert.arn,
      validationRecordFqdns: fqdns,
    });
  }
}

export { AcmResource };
