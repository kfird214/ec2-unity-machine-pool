@echo off

call %~dp0set-dotenv.bat

@echo on
aws s3 cp s3://%AWS_BUCKET%/unity-machines.state.json logs/unity-machines.state.s3.cloud.json --region eu-central-1