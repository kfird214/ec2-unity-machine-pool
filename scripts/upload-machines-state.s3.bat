@echo off

call %~dp0set-dotenv.bat

@echo on
aws s3 cp .config/unity-machines.state.json s3://%AWS_BUCKET%/ --region eu-central-1