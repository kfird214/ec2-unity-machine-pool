const { DynamoDBClient, ScanCommand, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE;

if (!TABLE_NAME) throw new Error("AWS_DYNAMODB_TABLE environment variable is required.");

console.log("Clearing table:", TABLE_NAME);

const dynamo = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

async function clearTable() {
    try {
        const scanCommand = new ScanCommand({ TableName: TABLE_NAME });
        const scanResult = await dynamo.send(scanCommand);

        console.log("Scanned items:", scanResult.Items.length);

        if (scanResult.Items.length == 0) {
            console.log("No items to delete.");
            return;
        }

        const deletePromises = scanResult.Items.map(async (item) => {
            const uitem = unmarshall(item);
            console.log("Deleting item:", uitem);
            const deleteCommand = new DeleteItemCommand({
                TableName: TABLE_NAME,
                Key: marshall({
                    allocationId: uitem.allocationId,
                    instanceId: uitem.instanceId,
                }),
            });
            await dynamo.send(deleteCommand);
        });

        await Promise.all(deletePromises);
        console.log("All items deleted successfully.");
    } catch (error) {
        console.error("Error clearing table:", error);
    }
}

clearTable();
