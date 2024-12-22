@echo off

call %~dp0set-dotenv.bat

@echo on
aws s3 cp s3://%AWS_BUCKET%/unity-machines.json logs/unity-machines.json --region eu-central-1