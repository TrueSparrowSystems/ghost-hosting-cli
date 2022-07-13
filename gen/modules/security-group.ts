// generated by cdktf get
// terraform-aws-modules/security-group/aws
import { TerraformModule } from 'cdktf';
import { Construct } from 'constructs';
export interface SecurityGroupOptions {
  /**
   * Map of groups of security group rules to use to generate modules (see update_groups.sh)
   * @default [object Object]
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly autoGroups?: { [key: string]: { [key: string]: string[] } };
  /**
   * List of computed egress rules to create by name
   * @default 
   */
  readonly computedEgressRules?: string[];
  /**
   * List of computed egress rules to create where 'cidr_blocks' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly computedEgressWithCidrBlocks?: { [key: string]: string }[];
  /**
   * List of computed egress rules to create where 'ipv6_cidr_blocks' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly computedEgressWithIpv6CidrBlocks?: { [key: string]: string }[];
  /**
   * List of computed egress rules to create where 'self' is defined
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly computedEgressWithSelf?: { [key: string]: string }[];
  /**
   * List of computed egress rules to create where 'source_security_group_id' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly computedEgressWithSourceSecurityGroupId?: { [key: string]: string }[];
  /**
   * List of computed ingress rules to create by name
   * @default 
   */
  readonly computedIngressRules?: string[];
  /**
   * List of computed ingress rules to create where 'cidr_blocks' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly computedIngressWithCidrBlocks?: { [key: string]: string }[];
  /**
   * List of computed ingress rules to create where 'ipv6_cidr_blocks' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly computedIngressWithIpv6CidrBlocks?: { [key: string]: string }[];
  /**
   * List of computed ingress rules to create where 'self' is defined
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly computedIngressWithSelf?: { [key: string]: string }[];
  /**
   * List of computed ingress rules to create where 'source_security_group_id' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly computedIngressWithSourceSecurityGroupId?: { [key: string]: string }[];
  /**
   * Whether to create security group and all rules
   * @default true
   */
  readonly create?: boolean;
  /**
   * Description of security group
   * @default Security Group managed by Terraform
   */
  readonly description?: string;
  /**
   * List of IPv4 CIDR ranges to use on all egress rules
   * @default 0.0.0.0/0
   */
  readonly egressCidrBlocks?: string[];
  /**
   * List of IPv6 CIDR ranges to use on all egress rules
   * @default ::/0
   */
  readonly egressIpv6CidrBlocks?: string[];
  /**
   * List of prefix list IDs (for allowing access to VPC endpoints) to use on all egress rules
   * @default 
   */
  readonly egressPrefixListIds?: string[];
  /**
   * List of egress rules to create by name
   * @default 
   */
  readonly egressRules?: string[];
  /**
   * List of egress rules to create where 'cidr_blocks' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly egressWithCidrBlocks?: { [key: string]: string }[];
  /**
   * List of egress rules to create where 'ipv6_cidr_blocks' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly egressWithIpv6CidrBlocks?: { [key: string]: string }[];
  /**
   * List of egress rules to create where 'self' is defined
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly egressWithSelf?: { [key: string]: string }[];
  /**
   * List of egress rules to create where 'source_security_group_id' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly egressWithSourceSecurityGroupId?: { [key: string]: string }[];
  /**
   * List of IPv4 CIDR ranges to use on all ingress rules
   * @default 
   */
  readonly ingressCidrBlocks?: string[];
  /**
   * List of IPv6 CIDR ranges to use on all ingress rules
   * @default 
   */
  readonly ingressIpv6CidrBlocks?: string[];
  /**
   * List of prefix list IDs (for allowing access to VPC endpoints) to use on all ingress rules
   * @default 
   */
  readonly ingressPrefixListIds?: string[];
  /**
   * List of ingress rules to create by name
   * @default 
   */
  readonly ingressRules?: string[];
  /**
   * List of ingress rules to create where 'cidr_blocks' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly ingressWithCidrBlocks?: { [key: string]: string }[];
  /**
   * List of ingress rules to create where 'ipv6_cidr_blocks' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly ingressWithIpv6CidrBlocks?: { [key: string]: string }[];
  /**
   * List of ingress rules to create where 'self' is defined
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly ingressWithSelf?: { [key: string]: string }[];
  /**
   * List of ingress rules to create where 'source_security_group_id' is used
   * @default 
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly ingressWithSourceSecurityGroupId?: { [key: string]: string }[];
  /**
   * Name of security group
   */
  readonly name: string;
  /**
   * Number of computed egress rules to create by name
   */
  readonly numberOfComputedEgressRules?: number;
  /**
   * Number of computed egress rules to create where 'cidr_blocks' is used
   */
  readonly numberOfComputedEgressWithCidrBlocks?: number;
  /**
   * Number of computed egress rules to create where 'ipv6_cidr_blocks' is used
   */
  readonly numberOfComputedEgressWithIpv6CidrBlocks?: number;
  /**
   * Number of computed egress rules to create where 'self' is defined
   */
  readonly numberOfComputedEgressWithSelf?: number;
  /**
   * Number of computed egress rules to create where 'source_security_group_id' is used
   */
  readonly numberOfComputedEgressWithSourceSecurityGroupId?: number;
  /**
   * Number of computed ingress rules to create by name
   */
  readonly numberOfComputedIngressRules?: number;
  /**
   * Number of computed ingress rules to create where 'cidr_blocks' is used
   */
  readonly numberOfComputedIngressWithCidrBlocks?: number;
  /**
   * Number of computed ingress rules to create where 'ipv6_cidr_blocks' is used
   */
  readonly numberOfComputedIngressWithIpv6CidrBlocks?: number;
  /**
   * Number of computed ingress rules to create where 'self' is defined
   */
  readonly numberOfComputedIngressWithSelf?: number;
  /**
   * Number of computed ingress rules to create where 'source_security_group_id' is used
   */
  readonly numberOfComputedIngressWithSourceSecurityGroupId?: number;
  /**
   * Instruct Terraform to revoke all of the Security Groups attached ingress and egress rules before deleting the rule itself. Enable for EMR.
   */
  readonly revokeRulesOnDelete?: boolean;
  /**
   * Map of known security group rules (define as 'name' = ['from port', 'to port', 'protocol', 'description'])
   * @default [object Object]
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly rules?: { [key: string]: any[] };
  /**
   * A mapping of tags to assign to security group
   * @default [object Object]
   * The property type contains a map, they have special handling, please see {@link cdk.tf/module-map-inputs the docs}
   */
  readonly tags?: { [key: string]: string };
  /**
   * Whether to use name_prefix or fixed name. Should be true to able to update security group name after initial creation
   * @default true
   */
  readonly useNamePrefix?: boolean;
  /**
   * ID of the VPC where to create security group
   */
  readonly vpcId: string;
}
export class SecurityGroup extends TerraformModule {
  private readonly inputs: { [name: string]: any } = { }
  public constructor(scope: Construct, id: string, options: SecurityGroupOptions) {
    super(scope, id, {
      source: 'terraform-aws-modules/security-group/aws',
      version: '~> 3.2',
    });
    this.autoGroups = options.autoGroups;
    this.computedEgressRules = options.computedEgressRules;
    this.computedEgressWithCidrBlocks = options.computedEgressWithCidrBlocks;
    this.computedEgressWithIpv6CidrBlocks = options.computedEgressWithIpv6CidrBlocks;
    this.computedEgressWithSelf = options.computedEgressWithSelf;
    this.computedEgressWithSourceSecurityGroupId = options.computedEgressWithSourceSecurityGroupId;
    this.computedIngressRules = options.computedIngressRules;
    this.computedIngressWithCidrBlocks = options.computedIngressWithCidrBlocks;
    this.computedIngressWithIpv6CidrBlocks = options.computedIngressWithIpv6CidrBlocks;
    this.computedIngressWithSelf = options.computedIngressWithSelf;
    this.computedIngressWithSourceSecurityGroupId = options.computedIngressWithSourceSecurityGroupId;
    this.create = options.create;
    this.description = options.description;
    this.egressCidrBlocks = options.egressCidrBlocks;
    this.egressIpv6CidrBlocks = options.egressIpv6CidrBlocks;
    this.egressPrefixListIds = options.egressPrefixListIds;
    this.egressRules = options.egressRules;
    this.egressWithCidrBlocks = options.egressWithCidrBlocks;
    this.egressWithIpv6CidrBlocks = options.egressWithIpv6CidrBlocks;
    this.egressWithSelf = options.egressWithSelf;
    this.egressWithSourceSecurityGroupId = options.egressWithSourceSecurityGroupId;
    this.ingressCidrBlocks = options.ingressCidrBlocks;
    this.ingressIpv6CidrBlocks = options.ingressIpv6CidrBlocks;
    this.ingressPrefixListIds = options.ingressPrefixListIds;
    this.ingressRules = options.ingressRules;
    this.ingressWithCidrBlocks = options.ingressWithCidrBlocks;
    this.ingressWithIpv6CidrBlocks = options.ingressWithIpv6CidrBlocks;
    this.ingressWithSelf = options.ingressWithSelf;
    this.ingressWithSourceSecurityGroupId = options.ingressWithSourceSecurityGroupId;
    this.name = options.name;
    this.numberOfComputedEgressRules = options.numberOfComputedEgressRules;
    this.numberOfComputedEgressWithCidrBlocks = options.numberOfComputedEgressWithCidrBlocks;
    this.numberOfComputedEgressWithIpv6CidrBlocks = options.numberOfComputedEgressWithIpv6CidrBlocks;
    this.numberOfComputedEgressWithSelf = options.numberOfComputedEgressWithSelf;
    this.numberOfComputedEgressWithSourceSecurityGroupId = options.numberOfComputedEgressWithSourceSecurityGroupId;
    this.numberOfComputedIngressRules = options.numberOfComputedIngressRules;
    this.numberOfComputedIngressWithCidrBlocks = options.numberOfComputedIngressWithCidrBlocks;
    this.numberOfComputedIngressWithIpv6CidrBlocks = options.numberOfComputedIngressWithIpv6CidrBlocks;
    this.numberOfComputedIngressWithSelf = options.numberOfComputedIngressWithSelf;
    this.numberOfComputedIngressWithSourceSecurityGroupId = options.numberOfComputedIngressWithSourceSecurityGroupId;
    this.revokeRulesOnDelete = options.revokeRulesOnDelete;
    this.rules = options.rules;
    this.tags = options.tags;
    this.useNamePrefix = options.useNamePrefix;
    this.vpcId = options.vpcId;
  }
  public get autoGroups(): { [key: string]: { [key: string]: string[] } } | undefined {
    return this.inputs['auto_groups'] as { [key: string]: { [key: string]: string[] } } | undefined;
  }
  public set autoGroups(value: { [key: string]: { [key: string]: string[] } } | undefined) {
    this.inputs['auto_groups'] = value;
  }
  public get computedEgressRules(): string[] | undefined {
    return this.inputs['computed_egress_rules'] as string[] | undefined;
  }
  public set computedEgressRules(value: string[] | undefined) {
    this.inputs['computed_egress_rules'] = value;
  }
  public get computedEgressWithCidrBlocks(): { [key: string]: string }[] | undefined {
    return this.inputs['computed_egress_with_cidr_blocks'] as { [key: string]: string }[] | undefined;
  }
  public set computedEgressWithCidrBlocks(value: { [key: string]: string }[] | undefined) {
    this.inputs['computed_egress_with_cidr_blocks'] = value;
  }
  public get computedEgressWithIpv6CidrBlocks(): { [key: string]: string }[] | undefined {
    return this.inputs['computed_egress_with_ipv6_cidr_blocks'] as { [key: string]: string }[] | undefined;
  }
  public set computedEgressWithIpv6CidrBlocks(value: { [key: string]: string }[] | undefined) {
    this.inputs['computed_egress_with_ipv6_cidr_blocks'] = value;
  }
  public get computedEgressWithSelf(): { [key: string]: string }[] | undefined {
    return this.inputs['computed_egress_with_self'] as { [key: string]: string }[] | undefined;
  }
  public set computedEgressWithSelf(value: { [key: string]: string }[] | undefined) {
    this.inputs['computed_egress_with_self'] = value;
  }
  public get computedEgressWithSourceSecurityGroupId(): { [key: string]: string }[] | undefined {
    return this.inputs['computed_egress_with_source_security_group_id'] as { [key: string]: string }[] | undefined;
  }
  public set computedEgressWithSourceSecurityGroupId(value: { [key: string]: string }[] | undefined) {
    this.inputs['computed_egress_with_source_security_group_id'] = value;
  }
  public get computedIngressRules(): string[] | undefined {
    return this.inputs['computed_ingress_rules'] as string[] | undefined;
  }
  public set computedIngressRules(value: string[] | undefined) {
    this.inputs['computed_ingress_rules'] = value;
  }
  public get computedIngressWithCidrBlocks(): { [key: string]: string }[] | undefined {
    return this.inputs['computed_ingress_with_cidr_blocks'] as { [key: string]: string }[] | undefined;
  }
  public set computedIngressWithCidrBlocks(value: { [key: string]: string }[] | undefined) {
    this.inputs['computed_ingress_with_cidr_blocks'] = value;
  }
  public get computedIngressWithIpv6CidrBlocks(): { [key: string]: string }[] | undefined {
    return this.inputs['computed_ingress_with_ipv6_cidr_blocks'] as { [key: string]: string }[] | undefined;
  }
  public set computedIngressWithIpv6CidrBlocks(value: { [key: string]: string }[] | undefined) {
    this.inputs['computed_ingress_with_ipv6_cidr_blocks'] = value;
  }
  public get computedIngressWithSelf(): { [key: string]: string }[] | undefined {
    return this.inputs['computed_ingress_with_self'] as { [key: string]: string }[] | undefined;
  }
  public set computedIngressWithSelf(value: { [key: string]: string }[] | undefined) {
    this.inputs['computed_ingress_with_self'] = value;
  }
  public get computedIngressWithSourceSecurityGroupId(): { [key: string]: string }[] | undefined {
    return this.inputs['computed_ingress_with_source_security_group_id'] as { [key: string]: string }[] | undefined;
  }
  public set computedIngressWithSourceSecurityGroupId(value: { [key: string]: string }[] | undefined) {
    this.inputs['computed_ingress_with_source_security_group_id'] = value;
  }
  public get create(): boolean | undefined {
    return this.inputs['create'] as boolean | undefined;
  }
  public set create(value: boolean | undefined) {
    this.inputs['create'] = value;
  }
  public get description(): string | undefined {
    return this.inputs['description'] as string | undefined;
  }
  public set description(value: string | undefined) {
    this.inputs['description'] = value;
  }
  public get egressCidrBlocks(): string[] | undefined {
    return this.inputs['egress_cidr_blocks'] as string[] | undefined;
  }
  public set egressCidrBlocks(value: string[] | undefined) {
    this.inputs['egress_cidr_blocks'] = value;
  }
  public get egressIpv6CidrBlocks(): string[] | undefined {
    return this.inputs['egress_ipv6_cidr_blocks'] as string[] | undefined;
  }
  public set egressIpv6CidrBlocks(value: string[] | undefined) {
    this.inputs['egress_ipv6_cidr_blocks'] = value;
  }
  public get egressPrefixListIds(): string[] | undefined {
    return this.inputs['egress_prefix_list_ids'] as string[] | undefined;
  }
  public set egressPrefixListIds(value: string[] | undefined) {
    this.inputs['egress_prefix_list_ids'] = value;
  }
  public get egressRules(): string[] | undefined {
    return this.inputs['egress_rules'] as string[] | undefined;
  }
  public set egressRules(value: string[] | undefined) {
    this.inputs['egress_rules'] = value;
  }
  public get egressWithCidrBlocks(): { [key: string]: string }[] | undefined {
    return this.inputs['egress_with_cidr_blocks'] as { [key: string]: string }[] | undefined;
  }
  public set egressWithCidrBlocks(value: { [key: string]: string }[] | undefined) {
    this.inputs['egress_with_cidr_blocks'] = value;
  }
  public get egressWithIpv6CidrBlocks(): { [key: string]: string }[] | undefined {
    return this.inputs['egress_with_ipv6_cidr_blocks'] as { [key: string]: string }[] | undefined;
  }
  public set egressWithIpv6CidrBlocks(value: { [key: string]: string }[] | undefined) {
    this.inputs['egress_with_ipv6_cidr_blocks'] = value;
  }
  public get egressWithSelf(): { [key: string]: string }[] | undefined {
    return this.inputs['egress_with_self'] as { [key: string]: string }[] | undefined;
  }
  public set egressWithSelf(value: { [key: string]: string }[] | undefined) {
    this.inputs['egress_with_self'] = value;
  }
  public get egressWithSourceSecurityGroupId(): { [key: string]: string }[] | undefined {
    return this.inputs['egress_with_source_security_group_id'] as { [key: string]: string }[] | undefined;
  }
  public set egressWithSourceSecurityGroupId(value: { [key: string]: string }[] | undefined) {
    this.inputs['egress_with_source_security_group_id'] = value;
  }
  public get ingressCidrBlocks(): string[] | undefined {
    return this.inputs['ingress_cidr_blocks'] as string[] | undefined;
  }
  public set ingressCidrBlocks(value: string[] | undefined) {
    this.inputs['ingress_cidr_blocks'] = value;
  }
  public get ingressIpv6CidrBlocks(): string[] | undefined {
    return this.inputs['ingress_ipv6_cidr_blocks'] as string[] | undefined;
  }
  public set ingressIpv6CidrBlocks(value: string[] | undefined) {
    this.inputs['ingress_ipv6_cidr_blocks'] = value;
  }
  public get ingressPrefixListIds(): string[] | undefined {
    return this.inputs['ingress_prefix_list_ids'] as string[] | undefined;
  }
  public set ingressPrefixListIds(value: string[] | undefined) {
    this.inputs['ingress_prefix_list_ids'] = value;
  }
  public get ingressRules(): string[] | undefined {
    return this.inputs['ingress_rules'] as string[] | undefined;
  }
  public set ingressRules(value: string[] | undefined) {
    this.inputs['ingress_rules'] = value;
  }
  public get ingressWithCidrBlocks(): { [key: string]: string }[] | undefined {
    return this.inputs['ingress_with_cidr_blocks'] as { [key: string]: string }[] | undefined;
  }
  public set ingressWithCidrBlocks(value: { [key: string]: string }[] | undefined) {
    this.inputs['ingress_with_cidr_blocks'] = value;
  }
  public get ingressWithIpv6CidrBlocks(): { [key: string]: string }[] | undefined {
    return this.inputs['ingress_with_ipv6_cidr_blocks'] as { [key: string]: string }[] | undefined;
  }
  public set ingressWithIpv6CidrBlocks(value: { [key: string]: string }[] | undefined) {
    this.inputs['ingress_with_ipv6_cidr_blocks'] = value;
  }
  public get ingressWithSelf(): { [key: string]: string }[] | undefined {
    return this.inputs['ingress_with_self'] as { [key: string]: string }[] | undefined;
  }
  public set ingressWithSelf(value: { [key: string]: string }[] | undefined) {
    this.inputs['ingress_with_self'] = value;
  }
  public get ingressWithSourceSecurityGroupId(): { [key: string]: string }[] | undefined {
    return this.inputs['ingress_with_source_security_group_id'] as { [key: string]: string }[] | undefined;
  }
  public set ingressWithSourceSecurityGroupId(value: { [key: string]: string }[] | undefined) {
    this.inputs['ingress_with_source_security_group_id'] = value;
  }
  public get name(): string {
    return this.inputs['name'] as string;
  }
  public set name(value: string) {
    this.inputs['name'] = value;
  }
  public get numberOfComputedEgressRules(): number | undefined {
    return this.inputs['number_of_computed_egress_rules'] as number | undefined;
  }
  public set numberOfComputedEgressRules(value: number | undefined) {
    this.inputs['number_of_computed_egress_rules'] = value;
  }
  public get numberOfComputedEgressWithCidrBlocks(): number | undefined {
    return this.inputs['number_of_computed_egress_with_cidr_blocks'] as number | undefined;
  }
  public set numberOfComputedEgressWithCidrBlocks(value: number | undefined) {
    this.inputs['number_of_computed_egress_with_cidr_blocks'] = value;
  }
  public get numberOfComputedEgressWithIpv6CidrBlocks(): number | undefined {
    return this.inputs['number_of_computed_egress_with_ipv6_cidr_blocks'] as number | undefined;
  }
  public set numberOfComputedEgressWithIpv6CidrBlocks(value: number | undefined) {
    this.inputs['number_of_computed_egress_with_ipv6_cidr_blocks'] = value;
  }
  public get numberOfComputedEgressWithSelf(): number | undefined {
    return this.inputs['number_of_computed_egress_with_self'] as number | undefined;
  }
  public set numberOfComputedEgressWithSelf(value: number | undefined) {
    this.inputs['number_of_computed_egress_with_self'] = value;
  }
  public get numberOfComputedEgressWithSourceSecurityGroupId(): number | undefined {
    return this.inputs['number_of_computed_egress_with_source_security_group_id'] as number | undefined;
  }
  public set numberOfComputedEgressWithSourceSecurityGroupId(value: number | undefined) {
    this.inputs['number_of_computed_egress_with_source_security_group_id'] = value;
  }
  public get numberOfComputedIngressRules(): number | undefined {
    return this.inputs['number_of_computed_ingress_rules'] as number | undefined;
  }
  public set numberOfComputedIngressRules(value: number | undefined) {
    this.inputs['number_of_computed_ingress_rules'] = value;
  }
  public get numberOfComputedIngressWithCidrBlocks(): number | undefined {
    return this.inputs['number_of_computed_ingress_with_cidr_blocks'] as number | undefined;
  }
  public set numberOfComputedIngressWithCidrBlocks(value: number | undefined) {
    this.inputs['number_of_computed_ingress_with_cidr_blocks'] = value;
  }
  public get numberOfComputedIngressWithIpv6CidrBlocks(): number | undefined {
    return this.inputs['number_of_computed_ingress_with_ipv6_cidr_blocks'] as number | undefined;
  }
  public set numberOfComputedIngressWithIpv6CidrBlocks(value: number | undefined) {
    this.inputs['number_of_computed_ingress_with_ipv6_cidr_blocks'] = value;
  }
  public get numberOfComputedIngressWithSelf(): number | undefined {
    return this.inputs['number_of_computed_ingress_with_self'] as number | undefined;
  }
  public set numberOfComputedIngressWithSelf(value: number | undefined) {
    this.inputs['number_of_computed_ingress_with_self'] = value;
  }
  public get numberOfComputedIngressWithSourceSecurityGroupId(): number | undefined {
    return this.inputs['number_of_computed_ingress_with_source_security_group_id'] as number | undefined;
  }
  public set numberOfComputedIngressWithSourceSecurityGroupId(value: number | undefined) {
    this.inputs['number_of_computed_ingress_with_source_security_group_id'] = value;
  }
  public get revokeRulesOnDelete(): boolean | undefined {
    return this.inputs['revoke_rules_on_delete'] as boolean | undefined;
  }
  public set revokeRulesOnDelete(value: boolean | undefined) {
    this.inputs['revoke_rules_on_delete'] = value;
  }
  public get rules(): { [key: string]: any[] } | undefined {
    return this.inputs['rules'] as { [key: string]: any[] } | undefined;
  }
  public set rules(value: { [key: string]: any[] } | undefined) {
    this.inputs['rules'] = value;
  }
  public get tags(): { [key: string]: string } | undefined {
    return this.inputs['tags'] as { [key: string]: string } | undefined;
  }
  public set tags(value: { [key: string]: string } | undefined) {
    this.inputs['tags'] = value;
  }
  public get useNamePrefix(): boolean | undefined {
    return this.inputs['use_name_prefix'] as boolean | undefined;
  }
  public set useNamePrefix(value: boolean | undefined) {
    this.inputs['use_name_prefix'] = value;
  }
  public get vpcId(): string {
    return this.inputs['vpc_id'] as string;
  }
  public set vpcId(value: string) {
    this.inputs['vpc_id'] = value;
  }
  public get thisSecurityGroupDescriptionOutput() {
    return this.getString('this_security_group_description')
  }
  public get thisSecurityGroupIdOutput() {
    return this.getString('this_security_group_id')
  }
  public get thisSecurityGroupNameOutput() {
    return this.getString('this_security_group_name')
  }
  public get thisSecurityGroupOwnerIdOutput() {
    return this.getString('this_security_group_owner_id')
  }
  public get thisSecurityGroupVpcIdOutput() {
    return this.getString('this_security_group_vpc_id')
  }
  protected synthesizeAttributes() {
    return this.inputs;
  }
}