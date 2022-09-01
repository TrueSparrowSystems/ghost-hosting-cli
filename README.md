# Ghost Hosting  CLI
It is a command line interactive tool to host the [Ghost](https://ghost.org/){:target="_blank"} on the AWS cloud. It simplifies the Ghost server deployment by utilizing the AWS infrastructure. It also provides the flexibility to host the fresh stack or to plug it into the existing infrastructure.

## Prerequisites
- Terraform >= 1.2.5
- NodeJS >= 14.17
- AWS account

## Deploment options

As it deploys on AWS, the following parameters are required by default. `AWS access key`, `AWS secret access key`, and `AWS region`. It also expects to have Route53 configured for the domain where you want to host the Ghost.

Either you can go with the existing VPC by providing comma-separated subnet ids or with the default selection for creating a new VPC and subnets. 

If you want to use the existing VPC, you need to provide the `subnet ids` to launch the ECS tasks (recommend private subnets) and `public subnet ids` to launch the load balancer (ALB). You can also use the existing load balancer (ALB) by providing the `load balancer listener ARN`.

It requires a `Ghost hosting url` where Ghost can be accessed on the web. If you want to host the static website for the generated content (please refer to how to generate the static content from Ghost [here](https://github.com/PLG-Works/ghost-static-website-generator){:target="_blank"}), you can also specify `Static website url` where it will provision the AWS S3 bucket to host the static website.

It also requires a MySQL database to store the Ghost configurations along with the content. For that, you can provide either existing DB credentials like DB host, DB name, DB user password, and database name. Else it will create a new RDS instance for the same.

## Why do I need to use this tool?
It gives the following benefits:
- Easy setup. You don't have to worry about provisioning each of the AWS resources by yourself.
- Make use of the existing infrastructure by providing the existing VPC subnets, load balancer, and database.
- Use this setup to provision and host the static website for the generated content.
- It uses AWS ECS with auto-scaling enabled. So, you don't have to worry about scalability.
- It can provide a cost-efficient setup by plugging in the existing load balancer and database. Also, it runs on AW FARGATE and utilizes the FARGATE SPOT resources.


## Example Usage:

- Deploy Ghost Stack
    ```bash
    ./run deploy
    ```

- Destroy Ghost Stack
    ```bash
    ./run destroy
    ```

## Development 

```bash
$ git clone git@github.com:PLG-Works/ghost-hosting-cli.git

$ cd ghost-hosting-cli

npm install

npm run watch
```

Run `./run deploy` in a new terminal window.
