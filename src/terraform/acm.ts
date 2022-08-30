import { Resource, Fn } from 'cdktf';
import { Construct } from 'constructs';

import { AcmCertificate, AcmCertificateValidation } from '../gen/providers/aws/acm';
import { DataAwsRoute53Zone, Route53Record } from '../gen/providers/aws/route53';

import { getRootDomainFromUrl } from '../lib/util';

interface Options {
  ghostHostingUrl: string;
}

interface Response {
  certificateArn: string;
}

const plgTags = {
  Name: 'PLG Ghost',
};

/**
 * @dev Resource to create certificate and attach it to the domain
 */
class AcmResource extends Resource {
  options: Options;

  constructor(scope: Construct, name: string, options: Options) {
    super(scope, name);

    this.options = options;
  }

  /**
   * @dev Main performer of the class
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
   * @param ghostHostingDomain
   * @private
   */
  _createCertificate(ghostHostingDomain: string): AcmCertificate {
    return new AcmCertificate(this, 'cert', {
      domainName: ghostHostingDomain,
      subjectAlternativeNames: [`*.${ghostHostingDomain}`],
      validationMethod: 'DNS',
      tags: plgTags,
      lifecycle: {
        createBeforeDestroy: false,
      },
    });
  }

  /**
   * @dev Get Route53 zone for the domain provided
   * @param ghostHostingDomain
   * @private
   */
  _getRoute53Zone(ghostHostingDomain: string): DataAwsRoute53Zone {
    return new DataAwsRoute53Zone(this, 'route_53_zone', {
      name: ghostHostingDomain,
    });
  }

  /**
   * @dev Create Route53 record
   * @param route53Zone
   * @param cert
   * @private
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
        zoneId: route53Zone.id,
      });

      fqdns.push(record.fqdn);
    }

    return fqdns;
  }

  /**
   * @dev Validate ACM certificate created for the domain
   * @param cert
   * @param fqdns
   * @private
   */
  _validateAcmCertificate(cert: AcmCertificate, fqdns: string[]): void {
    new AcmCertificateValidation(this, 'cert-validation', {
      certificateArn: cert.arn,
      validationRecordFqdns: fqdns,
    });
  }
}

export { AcmResource };
