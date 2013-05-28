var
	fs = require('fs'),
	exec = require('child_process').exec;

var ing = module.exports = {};

ing.current =
{
	index: null,
	command: null,
	options: null,
};

ing.load = function()
{
	var config = require('nconf').file({ file: 'config.json' }).stores.file.store;
	this.remotes = config.remotes;
	this.packages = config.packages;
	
	var remote = null;
	for(var i in this.remotes)
	{
		if(!remote)
			remote = i;
		
		var last = this.remotes[i].length - 1;
		if(this.remotes[i][last] == '/')
			this.remotes[i] = this.remotes[i].substr(0,last);
	}
	
	for(var i in this.packages)
	{
		if(typeof this.packages[i] == 'string')
		{
			this.packages[i] = { path: this.packages[i] };
		}
		
		if(typeof this.packages[i] != 'object')
			throw new Error('package: invalid configuration');
		if(!this.packages[i].path)
			throw new Error('package: missing path');
		if(this.packages[i].remote && !this.remotes[this.packages[i].remote])
			throw new Error('package: invalid remote');
		
		if(!this.packages[i].remote)
			this.packages[i].remote = remote;
	}
}

ing.do = function()
{
	if(process.argv[2] == 'init')
	{
		var
			user = process.argv[3],
			remotes = [];
		
		if(!user && fs.existsSync('.git/config'))
		{
			var git = fs.readFileSync('.git/config', 'utf8').split("\n");
			var remote = false;
			
			for(var i in git)
			{
				if(remote)
				{
					var match = git[i].match(/\turl = ([a-z]*):\/\/([^\/]*)@([^\/]*)\/.*/);
					if(match)
					{
						remotes.push([match[1] + '://' + match[3],match[2]])
					}
				}
				
				if(git[i].indexOf("[remote ") === 0)
					remote = true;
				else if(git[i].indexOf("[") === 0)
					remote = false;
			}
		}
		
		if(user || remotes.length)
		{
			for(var i in this.remotes)
			{
				for(var j in remotes)
				{
					user = remotes[j][1];
					
					if(this.remotes[i].indexOf(remotes[j][0]) === 0)
						break;
				}
				
				this.remotes[i] = this.remotes[i].replace('://','://' + user + '@');
			}
		}
		
		this.current.index = 0;
		this.init();
	}
	else
	{
		this.current.index = 0;
		this.current.command = this.command();
		this.iterate();
	}
}

ing.init = function()
{
	var name = this.next();
	if(!name) return;
	
	var path = this.packages[name].path;
	
	if(fs.existsSync(path))
		return this.init()
	
	var uri = this.remotes[this.packages[name].remote];
	if(name[0] == '/')
		uri += name;
	else
		uri += '/' + name + '.git';
	
	this.mkdir(path);
	
	this.current.command = 'git clone ' + uri + ' .';
	this.current.options = path;
	
	return this.exec(ing.init.bind(this));
}

ing.iterate = function()
{
	var name = this.next();
	if(!name) return;
	
	var path = this.packages[name].path;
	
	if(!fs.existsSync(path))
		return this.iterate();
	
	this.current.options = path;
	return this.exec(ing.iterate.bind(this));
}

ing.next = function()
{
	var i = 0, found = false;
	for(var name in this.packages)
	{
		if(this.current.index == i)
		{
			this.current.index++;
			found = true;
			break;
		}
		
		i++;
	}
	
	if(found)
		return name;
	else
		return null;
}

ing.command = function()
{
	var argv = process.argv.slice(2);
	argv.splice(0,0,'git');
	
	for(var i = 0; i < argv.length; i++)
	{
		if(argv[i].indexOf(' ') > -1)
			argv[i] = '"' + argv[i] + '"';
	}
	
	return argv.join(' ');
}

ing.exec = function(callback)
{
	if(typeof this.current.options == 'string')
		this.current.options = { cwd: this.current.options };
	
	if(!callback)
		callback = ing.exec.bind(this);
	
	return exec(this.current.command, this.current.options, callback);
}

ing.mkdir = function(path)
{
	path = path.split('/');
	for(var i = 0; i < path.length; i++)
	{
		var dir = path.slice(0, i + 1).join('/');
		if(!fs.existsSync(dir))
			fs.mkdirSync(dir);
	}
}

ing.load();
