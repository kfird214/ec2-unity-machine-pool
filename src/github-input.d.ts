export interface GithubInput {
    awsAccessKeyId: string
    awsSecretAccessKey: string
    awsRegion: string
    awsMachinesBucket: string
    awsDynamoDbTable: string
    allocateMachine: boolean

    /**
     * Required if `allocateMachine` is false.
     */
    allocationId?: string
}
