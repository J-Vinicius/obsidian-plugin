/* eslint-disable @typescript-eslint/no-explicit-any */
import { Plugin, Notice, Modal, App } from "obsidian";
import r34 from "r34";
import * as fs from "fs";
import * as path from "path";
import fetch from "node-fetch";

interface ApiResponse {
	id: number;
	[key: string]: any;
}

async function getIdFromHash(url: string): Promise<number | null> {
	// Regex to extract hash and random number from URL
	const regex =
		/samples\/(\d{1,4})\/sample_([a-fA-F0-9]{32})\.(jpg|png|jpeg|gif)/;
	const match = url.match(regex);

	if (!match) {
		throw new Error("Invalid URL format");
	}

	const randomNumber = match[1];
	const hash = match[2];

	console.log(`Random Number: ${randomNumber}`);
	console.log(`Hash: ${hash}`);

	// Construct the API URL
	const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=md5:${hash}`;

	try {
		// Fetch the JSON data from the API
		const response = await fetch(apiUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch API: ${response.statusText}`);
		}

		const data = await response.json();

		// Validate the response data
		if (Array.isArray(data) && data.length > 0) {
			const firstResult = data[0] as ApiResponse;
			if (typeof firstResult.id === "number") {
				console.log(`ID: ${firstResult.id}`);
				return firstResult.id;
			} else {
				throw new Error("Invalid ID in response data");
			}
		} else {
			console.log("No data found for the given hash");
			return null;
		}
	} catch (error) {
		console.error(`Error fetching data: ${(error as Error).message}`);
		return null;
	}
}

async function downloadImage(url: string, filePath: string) {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
		}

		const writer = fs.createWriteStream(filePath);
		return new Promise((resolve, reject) => {
			response.body?.pipe(writer);
			response.body?.on("error", reject);
			writer.on("finish", resolve);
			writer.on("error", reject);
		});
	} catch (error) {
		throw new Error(
			`Failed to download image from ${url}: ${error.message}`
		);
	}
}

async function main(hashUrl: string, vaultPath: string) {
	try {
		const id = await getIdFromHash(hashUrl);
		if (id === null) {
			throw new Error("No valid ID found.");
		}

		const data = await r34.getPostR34(id);

		if (!data || !data.image) {
			throw new Error("Invalid data received from API.");
		}

		const imageUrl = data.image;
		const baseDir = path.join(vaultPath, "Imagens");
		if (!fs.existsSync(baseDir)) {
			fs.mkdirSync(baseDir, { recursive: true });
		}

		const fileName = `${data.character || "Unknown"} - ${
			data.copyright || "Unknown"
		} by ${data.artist || data.meta || "Unknown"} [${data.id}].${
			data.type || "jpg"
		}`;
		const filePath = path.join(baseDir, fileName);

		await downloadImage(imageUrl, filePath);
		console.log("Imagem baixada com sucesso: " + filePath);
		new Notice("Imagem baixada com sucesso: " + filePath);
	} catch (error) {
		console.error("Erro ao baixar a imagem:", error);
		new Notice("Erro ao baixar a imagem: " + error.message);
	}
}

// Modal for user input
class CodeInputModal extends Modal {
	onSubmit: (input: string) => void;
	vaultPath: string;

	constructor(
		app: App,
		vaultPath: string,
		onSubmit: (input: string) => void
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.vaultPath = vaultPath;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: "Enter the URL" });
		contentEl.createEl("span", {
			text: "The plugin doesn't accept URLs of mp4 links. Only images like png, jpg, jpeg, and gifs",
		});

		const divInput = contentEl.createEl("div", { cls: "r34__div" });
		const input = divInput.createEl("input");
		input.setAttr("placeholder", "Enter URL...");
		input.setAttr("type", "text");

		const submitButton = divInput.createEl("button", { text: "Download" });
		submitButton.addEventListener("click", () => {
			const userInput = input.value;
			if (!userInput) {
				new Notice("Invalid URL. Please enter a valid URL.");
			} else {
				this.onSubmit(userInput);
				this.close();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export default class Rule34Downloader extends Plugin {
	onload() {
		// Get the absolute path to the vault directory
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const vaultPath = (this.app.vault.adapter as any).basePath;
		this.addRibbonIcon("image-plus", "Open Code Input", () => {
			new CodeInputModal(this.app, vaultPath, (url: string) => {
				main(url, vaultPath);
			}).open();
		});
	}
}
