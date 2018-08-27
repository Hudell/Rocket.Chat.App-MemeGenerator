import {
	IConfigurationExtend,
	IConfigurationModify,
	IEnvironmentRead,
	ILogger,
	IRead,
	IModify,
	IHttp,
	IPersistence,
	HttpStatusCode
} from '@rocket.chat/apps-ts-definition/accessors';

import {
	ISlashCommand,
	SlashCommandContext
} from '@rocket.chat/apps-ts-definition/slashcommands';

import { App } from '@rocket.chat/apps-ts-definition/App';
import { IAppInfo } from '@rocket.chat/apps-ts-definition/metadata';

const url = 'https://memegen.link/api/templates/';
const memeList: {title: string, url:string, name:string}[] = [];

const generateMemeList = async function(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
	const builder = modify.getCreator().startMessage().setSender(context.getSender()).setRoom(context.getRoom());

	if (memeList.length === 0) {
		const response = await http.get(url);
		if (response.statusCode !== HttpStatusCode.OK || !response.data) {
			this.app.getLogger().debug('Did not get a valid response', response);
			builder.setText('Failed to retrieve meme list.');
			modify.getNotifer().notifyUser(context.getSender(), builder.getMessage());
			return;
		}

		for (const title in response.data) {
			const templateUrl = response.data[title];
			const templateName = templateUrl.replace(url, '');

			memeList.push({
				title,
				url: templateUrl,
				name: templateName
			});
		}
	}

	let lines = '';
	memeList.forEach((template) => {
		lines = `${ lines }*${ template.name }*: _${ template.title }_\n`;
	});
	builder.setText(lines);

	modify.getNotifer().notifyUser(context.getSender(), builder.getMessage());
}

export class MemeAppCommand implements ISlashCommand {
	public command: string;
	public i18nDescription: string;
	public i18nParamsExample: string;
	public providesPreview: false;

	constructor(private readonly app: App) {
		this.command = 'meme';
		this.i18nParamsExample = '';
		this.i18nDescription = 'Generate a meme.';
		this.providesPreview = false;
	}

	public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
		const args = context.getArguments();
		if (args.length > 0 && args[0].trim().toLowerCase() === 'list') {
			generateMemeList(context, read, modify, http, persis);
			return;
		}

		const builder = modify.getCreator().startMessage().setSender(context.getSender()).setRoom(context.getRoom());

		if (args.length < 2) {
			this.app.getLogger().debug('Invalid arguments', args);
			builder.setText('Invalid arguments');
			modify.getNotifer().notifyUser(context.getSender(), builder.getMessage());
			return;
		}
		
		const meme = args[0];
		const line1 = args[1];
		const line2 = args.length > 2 ? args[2] : '';

		this.app.getLogger().debug(args);

		const memeUrl = `${ url }${ meme }/${ line1 }/${ line2 }`;

		const response = await http.get(memeUrl);
		if (response.statusCode !== HttpStatusCode.OK || !response.data) {
			this.app.getLogger().debug('Did not get a valid response', response);
			builder.setText('Invalid meme.');
			modify.getNotifer().notifyUser(context.getSender(), builder.getMessage());
			return;
		}

		const text = response.data.direct.masked;

		builder.addAttachment({
			title: {
				value: meme
			},
			imageUrl: text
		});

		await modify.getCreator().finish(builder);
	}
}

export class MemeListAppCommand implements ISlashCommand {
	public command: string;
	public i18nDescription: string;
	public i18nParamsExample: string;
	public providesPreview: false;

	constructor(private readonly app: App) {
		this.command = 'meme-list';
		this.i18nParamsExample = '';
		this.i18nDescription = 'Get a list of valid meme templates';
		this.providesPreview = false;
	}

	public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
		generateMemeList(context, read, modify, http, persis);
	}
}

export class MemeApp extends App {
	constructor(info: IAppInfo, logger: ILogger) {
		super(info, logger);
	}

	public async initialize(configurationExtend: IConfigurationExtend, environmentRead: IEnvironmentRead): Promise<void> {
		await this.extendConfiguration(configurationExtend, environmentRead);
		configurationExtend.slashCommands.provideSlashCommand(new MemeAppCommand(this));
		configurationExtend.slashCommands.provideSlashCommand(new MemeListAppCommand(this));
	}
}