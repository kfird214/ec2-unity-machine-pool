export interface GithubInput {
    awsAccessKeyId: string
    awsSecretAccessKey: string
    awsRegion: string
    awsMachinesBucket: string
    allocateMachine: boolean

    /**
     * Required if `allocateMachine` is false.
     */
    allocationId?: string
}
