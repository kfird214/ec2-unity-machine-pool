@echo off

call %~dp0set-dotenv.bat

@REM assert AWS_DYNAMODB_TABLE is set
if "%AWS_DYNAMODB_TABLE%" == "" (
    echo AWS_DYNAMODB_TABLE is not set
    exit /b 1
)

@echo on
aws dynamodb scan --table-name %AWS_DYNAMODB_TABLE% --output json --region "eu-central-1" > logs/unity-machines.state.dynamo.cloud.json
