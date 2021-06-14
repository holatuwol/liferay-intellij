var fs = require('fs');
var highland = require('highland');
var streams2 = require('../streams2/streams2');
var streams3 = require('../streams4/streams3');
var streams5 = require('../streams6/streams5');

var excludeFolderMap = streams3.excludeFolderMap;
var getFilePath = streams5.getFilePath;
var isDirectory = streams2.isDirectory;

function createProjectWorkspace(coreDetails, moduleDetails) {
	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);

	var detailsStream = highland.merge([moduleStream, coreStream]);

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();

	moduleFilesStream
		.map(getModuleXML)
		.map(getIntellijXML)
		.each(saveContent);

	detailsStream.done(function() {});
};

function getAttributeXML(component) {
	var attributeXML = [];

	for (key in component) {
		if (key == 'content') {
			continue;
		}

		attributeXML.push(' ');
		attributeXML.push(key);
		attributeXML.push('="');
		attributeXML.push(component[key].replace(/"/g, '&quot;'))
		attributeXML.push('"');
	}

	return attributeXML.join('');
}

function getComponentXML(component) {
	return '<component' + getAttributeXML(component) + '>\n' + component.content + '\n</component>';
};

function getExcludeFolderElement(folder) {
	return '<excludeFolder url="file://$MODULE_DIR$/' + folder + '" />';
};

function getFacetManagerXML(module) {
	var facetManagerXML = [];

	if (module.webrootFolders.length > 0) {
		facetManagerXML = [
			'<facet type="web" name="' + module.moduleName + '">',
			'<configuration>'
		];

		if ('docroot' == module.webrootFolders[0]) {
			facetManagerXML.push(
				'<descriptors>',
				'<deploymentDescriptor name="web.xml" url="file://$MODULE_DIR$/docroot/WEB-INF/web.xml" />',
				'</descriptors>'
			);
		}

		facetManagerXML.push(
			'<webroots>',
			'<root url="file://$MODULE_DIR$/' + module.webrootFolders[0] + '" relative="/" />',
			'</webroots>',
			'</configuration>',
			'</facet>'
		);
	}

	var springFolders = [
		'src/META-INF',
		'docroot/WEB-INF/src/META-INF',
		'src/main/resources/META-INF',
		'src/main/resources/META-INF/spring',
		'src/main/resources/META-INF/spring/parent'
	];

	var springXMLFiles = Array.prototype.concat.apply([], springFolders.map(highland.partial(getSpringFolders, module.modulePath)));

	if (springXMLFiles.length > 0) {
		facetManagerXML.push(
			'<facet type="Spring" name="' + module.moduleName + '">',
			'<configuration>',
			'<fileset id="fileset" name="Spring Application Context" removed="false">'
		);

		facetManagerXML = facetManagerXML.concat(springXMLFiles.map(getSpringFacetFileElement));

		facetManagerXML.push(
			'</fileset>',
			'</configuration>',
			'</facet>'
		);
	}

	return facetManagerXML.join('\n');
};

function getIndent(indent) {
	return new Array(indent + 1).join('  ');
};

function getIntellijXML(fileData) {
	var xmlContent = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<module type="JAVA_MODULE" version="4">'
	];

	fileData.components
		.map(
			highland.ncurry(1, getComponentXML)
		)
		.filter(
			highland.compose(highland.not, highland.not)
		)
		.forEach(
			highland.ncurry(1, Array.prototype.push.bind(xmlContent))
		);

	xmlContent.push('</module>');

	return {
		name: fileData.fileName,
		content: xmlContent.join('\n')
	};
};

function getModuleIMLPath(module) {
	return getFilePath(module.modulePath, module.moduleName + '.iml');
};

function getModuleXML(module) {
	return {
		fileName: getModuleIMLPath(module),
		components: [
			{
				name: 'NewModuleRootManager',
				content: getNewModuleRootManagerXML(module)
			},
			{
				name: 'FacetManager',
				content: getFacetManagerXML(module)
			}
		]
	};
};

function getOutputURLElements(module) {
	var outputFolder = 'classes';

	if (module.excludeFolders.indexOf('docroot/WEB-INF/classes') != -1) {
		outputFolder = 'docroot/WEB-INF/classes';
	}

	var outputURLElements = ['<output url="file://$MODULE_DIR$/' + outputFolder + '" />'];
	var testOutputFolder = null;

	if (module.testSourceFolders.length == 1) {
		testOutputFolder = excludeFolderMap[module.testSourceFolders[0]];
	}
	else if (module.testSourceFolders.length > 1) {
		testOutputFolder = "test-classes/unit";
	}

	if (testOutputFolder != null) {
		outputURLElements.push('<output-test url="file://$MODULE_DIR$/' + testOutputFolder + '" />');
	}

	return outputURLElements;
};

function getNewModuleRootManagerXML(module) {
	var newModuleRootManagerXML = getOutputURLElements(module);

	newModuleRootManagerXML.push('<content url="file://$MODULE_DIR$">');

	newModuleRootManagerXML = newModuleRootManagerXML.concat(
		module.sourceFolders.map(highland.partial(getSourceFolderElement, 'isTestSource', 'false')),
		module.resourceFolders.map(highland.partial(getSourceFolderElement, 'type', 'java-resource')),
		module.testSourceFolders.map(highland.partial(getSourceFolderElement, 'isTestSource', 'true')),
		module.testResourceFolders.map(highland.partial(getSourceFolderElement, 'type', 'java-test-resource')),
		module.excludeFolders.map(getExcludeFolderElement)
	);

	newModuleRootManagerXML.push('</content>');
	newModuleRootManagerXML.push('<orderEntry type="inheritedJdk" />');
	newModuleRootManagerXML.push('<orderEntry type="sourceFolder" forTests="false" />');

	return newModuleRootManagerXML.join('\n');
};

function getSourceFolderElement(attributeName, attributeValue, folder) {
	return '<sourceFolder url="file://$MODULE_DIR$/' + folder + '" ' +
		attributeName + '="' + attributeValue + '" />';
};

function getSpringFacetFileElement(springXMLFile) {
	return '<file>file://$MODULE_DIR$/' + springXMLFile + '</file>';
};

function getSpringFolders(modulePath, subfolder) {
	var springFolder = getFilePath(modulePath, subfolder);

	if (!isDirectory(springFolder)) {
		return [];
	}

	return fs.readdirSync(springFolder).map(getFilePath(subfolder)).filter(isSpringXML);
};

function isSpringXML(path) {
	return ((path.indexOf('/spring/') != -1) || (path.indexOf('-spring') != -1)) && (path.indexOf('.xml') != -1);
};

function saveContent(file) {
	var indent = 0;
	var splitContent = file.content.split('\n')
		.filter(highland.compose(highland.not, highland.not));

	for (var i = 0; i < splitContent.length; i++) {
		var line = splitContent[i].trim();
		splitContent[i] = getIndent(indent) + line;

		if (line.indexOf('<?') == 0) {
			continue;
		}

		if (line.indexOf('<') == -1) {
			splitContent[i] = getIndent(++indent) + line;
			continue;
		}

		if (line.indexOf('/>') != -1) {
			continue;
		}

		if (line.indexOf('<') == line.indexOf('</')) {
			splitContent[i] = getIndent(--indent) + line;
		}

		if (line.indexOf('</') == -1) {
			++indent;
		}
	}

	fs.writeFileSync(file.name, splitContent.join('\n'));
};

exports.createProjectWorkspace = createProjectWorkspace;
exports.getComponentXML = getComponentXML;
exports.getExcludeFolderElement = getExcludeFolderElement;
exports.getFacetManagerXML = getFacetManagerXML;
exports.getSourceFolderElement = getSourceFolderElement;
exports.getIntellijXML = getIntellijXML;
exports.getModuleIMLPath = getModuleIMLPath;
exports.getModuleXML = getModuleXML;
exports.getNewModuleRootManagerXML = getNewModuleRootManagerXML;
exports.getOutputURLElements = getOutputURLElements;
exports.saveContent = saveContent;