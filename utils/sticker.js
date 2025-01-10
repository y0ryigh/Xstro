import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import Crypto from 'crypto';
import webp from 'node-webpmux';
import { tmpdir } from 'os';
import { getMimeType } from 'xstro-utils';
import { config } from '#config';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function imageToWebp(media) {
	const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
	const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpg`);

	fs.writeFileSync(tmpFileIn, media);

	await new Promise((resolve, reject) => {
		ffmpeg(tmpFileIn)
			.on('error', reject)
			.on('end', () => resolve(true))
			.addOutputOptions(['-vcodec', 'libwebp', '-vf', "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse"])
			.toFormat('webp')
			.save(tmpFileOut);
	});

	const buff = fs.readFileSync(tmpFileOut);
	fs.unlinkSync(tmpFileOut);
	fs.unlinkSync(tmpFileIn);
	return buff;
}

async function videoToWebp(media) {
	const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
	const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.mp4`);

	fs.writeFileSync(tmpFileIn, media);

	await new Promise((resolve, reject) => {
		ffmpeg(tmpFileIn)
			.on('error', reject)
			.on('end', () => resolve(true))
			.addOutputOptions(['-vcodec', 'libwebp', '-vf', "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse", '-loop', '0', '-ss', '00:00:00', '-t', '00:00:05', '-preset', 'default', '-an', '-vsync', '0'])
			.toFormat('webp')
			.save(tmpFileOut);
	});

	const buff = fs.readFileSync(tmpFileOut);
	fs.unlinkSync(tmpFileOut);
	fs.unlinkSync(tmpFileIn);
	return buff;
}

async function writeExifImg(media, metadata = {}) {
	let wMedia = await imageToWebp(media);
	const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
	const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
	fs.writeFileSync(tmpFileIn, wMedia);

	if (metadata.packname || metadata.author) {
		const img = new webp.Image();
		const json = {
			'sticker-pack-id': `https://github.com/AstroX11/Xstro`,
			'sticker-pack-name': metadata.packname,
			'sticker-pack-publisher': metadata.author,
			emojis: metadata.categories ? metadata.categories : [''],
		};
		const exifAttr = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
		const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
		const exif = Buffer.concat([exifAttr, jsonBuff]);
		exif.writeUIntLE(jsonBuff.length, 14, 4);
		await img.load(tmpFileIn);
		fs.unlinkSync(tmpFileIn);
		img.exif = exif;
		await img.save(tmpFileOut);
		return fs.readFileSync(tmpFileOut);
	}
}

async function writeExifVid(media, metadata = {}) {
	let wMedia = await videoToWebp(media);
	const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
	const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
	fs.writeFileSync(tmpFileIn, wMedia);

	if (metadata.packname || metadata.author) {
		const img = new webp.Image();
		const json = {
			'sticker-pack-id': `https://github.com/AstroX11/Xstro`,
			'sticker-pack-name': metadata.packname,
			'sticker-pack-publisher': metadata.author,
			emojis: metadata.categories ? metadata.categories : [''],
		};
		const exifAttr = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
		const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
		const exif = Buffer.concat([exifAttr, jsonBuff]);
		exif.writeUIntLE(jsonBuff.length, 14, 4);
		await img.load(tmpFileIn);
		fs.unlinkSync(tmpFileIn);
		img.exif = exif;
		await img.save(tmpFileOut);
		return fs.readFileSync(tmpFileOut);
	}
}

/**
 * Converts media to a WhatsApp Sticker.
 * @param {Buffer} buffer - Media buffer (image or video).
 * @param {string} pack - Sticker pack name.
 * @param {string} author - Sticker author name.
 * @returns {Promise<Buffer>} - Sticker WebP buffer.
 */
export const createSticker = async buffer => {
	const mime = await getMimeType(buffer);
	let res;
	const options = { packname: config.STICKER_PACK.split(';')[0] || 'χѕтяσ м∂', author: config.STICKER_PACK.split(';')[1] || 'αѕтяσχ11' };
	if (mime.startsWith('image/')) {
		res = await writeExifImg(buffer, options);
	} else if (mime.startsWith('video/')) {
		res = await writeExifVid(buffer, options);
	} else {
		throw new Error('Only images and videos are supported');
	}
	return res;
};
