import axios from "axios";

export async function getCoinData(mintStr: string): Promise<any | null> {
    try {
        const url = `https://frontend-api.pump.fun/coins/${mintStr}`;
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
                "Accept": "*/*",
                "Referer": "https://www.pump.fun/",
                "Origin": "https://www.pump.fun",
            },
        });

        if (response.status === 200) {
            return response.data;
        } else {
            console.error("Failed to retrieve coin data:", response.status, response.statusText);
            return null;
        }
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            console.error("Axios error fetching coin data:", error.response?.data || error.message);
        } else {
            console.error("Unexpected error:", error.message);
        }
        return null;
    }
}

// Create a main function to run the code.
async function main() {
    const mint = "8oJNJTrr1b9e5beQ3PhBd9cSjQPfwqu3staCEVJpump";
    const coinData = await getCoinData(mint);
    if (coinData) {
        console.log("Coin data:", coinData);
    } else {
        console.error("Failed to retrieve coin data.");
    }
}

// Run the main function.
main();
