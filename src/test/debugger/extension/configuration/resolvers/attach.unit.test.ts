// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-invalid-template-strings no-any no-object-literal-type-assertion no-invalid-this

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { DebugConfiguration, DebugConfigurationProvider, TextDocument, TextEditor, Uri, WorkspaceFolder } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../../../../client/common/application/types';
import { PYTHON_LANGUAGE } from '../../../../../client/common/constants';
import { IFileSystem, IPlatformService } from '../../../../../client/common/platform/types';
import { IConfigurationService } from '../../../../../client/common/types';
import { getNamesAndValues } from '../../../../../client/common/utils/enum';
import { OSType } from '../../../../../client/common/utils/platform';
import { AttachConfigurationResolver } from '../../../../../client/debugger/extension/configuration/resolvers/attach';
import { AttachRequestArguments, DebugOptions } from '../../../../../client/debugger/types';
import { IServiceContainer } from '../../../../../client/ioc/types';

getNamesAndValues(OSType).forEach(os => {
    if (os.value === OSType.Unknown) {
        return;
    }
    suite(`Debugging - Config Resolver attach, OS = ${os.name}`, () => {
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let debugProvider: DebugConfigurationProvider;
        let platformService: TypeMoq.IMock<IPlatformService>;
        let fileSystem: TypeMoq.IMock<IFileSystem>;
        let documentManager: TypeMoq.IMock<IDocumentManager>;
        let configurationService: TypeMoq.IMock<IConfigurationService>;
        let workspaceService: TypeMoq.IMock<IWorkspaceService>;
        const debugOptionsAvailable = [DebugOptions.RedirectOutput];
        if (os.value === OSType.Windows) {
            debugOptionsAvailable.push(DebugOptions.FixFilePathCase);
            debugOptionsAvailable.push(DebugOptions.WindowsClient);
        } else {
            debugOptionsAvailable.push(DebugOptions.UnixClient);
        }
        debugOptionsAvailable.push(DebugOptions.ShowReturnValue);
        setup(() => {
            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
            platformService = TypeMoq.Mock.ofType<IPlatformService>();
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
            fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformService.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
            platformService.setup(p => p.isWindows).returns(() => os.value === OSType.Windows);
            platformService.setup(p => p.isMac).returns(() => os.value === OSType.OSX);
            platformService.setup(p => p.isLinux).returns(() => os.value === OSType.Linux);
            documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
            debugProvider = new AttachConfigurationResolver(workspaceService.object, documentManager.object, platformService.object, configurationService.object);
        });
        function createMoqWorkspaceFolder(folderPath: string) {
            const folder = TypeMoq.Mock.ofType<WorkspaceFolder>();
            folder.setup(f => f.uri).returns(() => Uri.file(folderPath));
            return folder.object;
        }
        function setupActiveEditor(fileName: string | undefined, languageId: string) {
            if (fileName) {
                const textEditor = TypeMoq.Mock.ofType<TextEditor>();
                const document = TypeMoq.Mock.ofType<TextDocument>();
                document.setup(d => d.languageId).returns(() => languageId);
                document.setup(d => d.fileName).returns(() => fileName);
                textEditor.setup(t => t.document).returns(() => document.object);
                documentManager.setup(d => d.activeTextEditor).returns(() => textEditor.object);
            } else {
                documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
            }
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDocumentManager))).returns(() => documentManager.object);
        }
        function setupWorkspaces(folders: string[]) {
            const workspaceFolders = folders.map(createMoqWorkspaceFolder);
            workspaceService.setup(w => w.workspaceFolders).returns(() => workspaceFolders);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
        }
        test('Defaults should be returned when an empty object is passed with a Workspace Folder and active file', async () => {
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';

            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { request: 'attach' } as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('request', 'attach');
            expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and active file', async () => {
            const pythonFile = 'xyz.py';

            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);
            setupWorkspaces([]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, { request: 'attach' } as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.least(3);
            expect(debugConfig).to.have.property('request', 'attach');
            expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
            expect(debugConfig).to.have.property('host', 'localhost');
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and no active file', async () => {
            setupActiveEditor(undefined, PYTHON_LANGUAGE);
            setupWorkspaces([]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, { request: 'attach' } as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.least(3);
            expect(debugConfig).to.have.property('request', 'attach');
            expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
            expect(debugConfig).to.have.property('host', 'localhost');
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and non python file', async () => {
            const activeFile = 'xyz.js';

            setupActiveEditor(activeFile, 'javascript');
            setupWorkspaces([]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, { request: 'attach' } as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.least(3);
            expect(debugConfig).to.have.property('request', 'attach');
            expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
            expect(debugConfig).to.not.have.property('localRoot');
            expect(debugConfig).to.have.property('host', 'localhost');
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, with a workspace and an active python file', async () => {
            const activeFile = 'xyz.py';
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, { request: 'attach' } as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.least(3);
            expect(debugConfig).to.have.property('request', 'attach');
            expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
            expect(debugConfig).to.have.property('host', 'localhost');
        });
        test('Ensure \'localRoot\' is left unaltered', async () => {
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const localRoot = `Debug_PythonPath_${new Date().toString()}`;
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { localRoot, request: 'attach' } as any as DebugConfiguration);

            expect(debugConfig).to.have.property('localRoot', localRoot);
        });
        ['localhost', '127.0.0.1', '::1'].forEach(host => {
            test(`Ensure path mappings are automatically added when host is '${host}'`, async () => {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);

                const localRoot = `Debug_PythonPath_${new Date().toString()}`;
                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { localRoot, host, request: 'attach' } as any as DebugConfiguration);

                expect(debugConfig).to.have.property('localRoot', localRoot);
                const pathMappings = (debugConfig as AttachRequestArguments).pathMappings;
                expect(pathMappings).to.be.lengthOf(1);
                expect(pathMappings![0].localRoot).to.be.equal(workspaceFolder.uri.fsPath);
                expect(pathMappings![0].remoteRoot).to.be.equal(workspaceFolder.uri.fsPath);
            });
        });
        ['192.168.1.123', 'don.debugger.com'].forEach(host => {
            test(`Ensure path mappings are not automatically added when host is '${host}'`, async () => {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);

                const localRoot = `Debug_PythonPath_${new Date().toString()}`;
                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { localRoot, host, request: 'attach' } as any as DebugConfiguration);

                expect(debugConfig).to.have.property('localRoot', localRoot);
                const pathMappings = (debugConfig as AttachRequestArguments).pathMappings;
                expect(pathMappings).to.be.lengthOf(0);
            });
        });
        test('Ensure \'localRoot\' and \'remoteRoot\' is used', async () => {
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const localRoot = `Debug_PythonPath_Local_Root_${new Date().toString()}`;
            const remoteRoot = `Debug_PythonPath_Remote_Root_${new Date().toString()}`;
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { localRoot, remoteRoot, request: 'attach' } as any as DebugConfiguration);

            expect(debugConfig!.pathMappings).to.be.lengthOf(1);
            expect(debugConfig!.pathMappings).to.deep.include({ localRoot, remoteRoot });
        });
        test('Ensure \'localRoot\' and \'remoteRoot\' is used', async () => {
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const localRoot = `Debug_PythonPath_Local_Root_${new Date().toString()}`;
            const remoteRoot = `Debug_PythonPath_Remote_Root_${new Date().toString()}`;
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { localRoot, remoteRoot, request: 'attach' } as any as DebugConfiguration);

            expect(debugConfig!.pathMappings).to.be.lengthOf(1);
            expect(debugConfig!.pathMappings).to.deep.include({ localRoot, remoteRoot });
        });
        test('Ensure \'remoteRoot\' is left unaltered', async () => {
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const remoteRoot = `Debug_PythonPath_${new Date().toString()}`;
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { remoteRoot, request: 'attach' } as any as DebugConfiguration);

            expect(debugConfig).to.have.property('remoteRoot', remoteRoot);
        });
        test('Ensure \'port\' is left unaltered', async () => {
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const port = 12341234;
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { port, request: 'attach' } as any as DebugConfiguration);

            expect(debugConfig).to.have.property('port', port);
        });
        test('Ensure \'debugOptions\' are left unaltered', async () => {
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugOptions = debugOptionsAvailable.slice().concat(DebugOptions.Jinja, DebugOptions.Sudo);
            const expectedDebugOptions = debugOptions.slice();
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { debugOptions, request: 'attach' } as any as DebugConfiguration);

            expect(debugConfig).to.have.property('debugOptions').to.be.deep.equal(expectedDebugOptions);
        });

        const testsForJustMyCode =
            [
                {
                    justMyCode: false,
                    debugStdLib: true,
                    expectedResult: false
                },
                {
                    justMyCode: false,
                    debugStdLib: false,
                    expectedResult: false
                },
                {
                    justMyCode: false,
                    debugStdLib: undefined,
                    expectedResult: false
                },
                {
                    justMyCode: true,
                    debugStdLib: false,
                    expectedResult: true
                },
                {
                    justMyCode: true,
                    debugStdLib: true,
                    expectedResult: true
                },
                {
                    justMyCode: true,
                    debugStdLib: undefined,
                    expectedResult: true
                },
                {
                    justMyCode: undefined,
                    debugStdLib: false,
                    expectedResult: true
                },
                {
                    justMyCode: undefined,
                    debugStdLib: true,
                    expectedResult: false
                },
                {
                    justMyCode: undefined,
                    debugStdLib: undefined,
                    expectedResult: true
                }
            ];
        test('Ensure justMyCode property is correctly derived from debugStdLib', async () => {
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugOptions = debugOptionsAvailable.slice().concat(DebugOptions.Jinja, DebugOptions.Sudo);

            testsForJustMyCode.forEach(async testParams => {
                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { debugOptions, request: 'attach', justMyCode: testParams.justMyCode, debugStdLib: testParams.debugStdLib } as any as DebugConfiguration);
                expect(debugConfig).to.have.property('justMyCode', testParams.expectedResult);
            });
        });
    });
});
