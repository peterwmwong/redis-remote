const fs = require('fs'),
      redis = require('redis'),
      spawn = require('child_process').spawn,
      exec = require('child_process').exec,
      path = require('path'),
      tmpdir = '/tmp/',
      l = console.log;

var MockServer = function(cfg,dmpFile, cb){
   if(!(this instanceof MockServer)){
      return new MockServer(cfg,dmpFile, cb);
   }
   
   var self = this,
       stopped = false,
       port = null,
       proc = spawn('redis-server',['-']);
   
   var serverOutHandler = function(data){
      const res = /.*?accept connections on port (.*)/g.exec(data.toString());
      if(res){
         port = (new Number(res[1])).valueOf();
         l('[redis-server] SERVER STARTED on port '+port);
         try {
            cb && cb(null,self);
         }catch(e){
            l('[redis-server] ERROR Callback threw error.',e);
         }
         proc.stdout.removeListener('data',serverOutHandler);
         delete serverOutHandler;
      }
   };
   
   if(proc.pid){
      proc.stdout.on('data', serverOutHandler);
      proc.stderr.on('data', function(data){console.log(data.toString());});
      proc.stdin.write(cfg);
      proc.stdin.end();
   }
   
   Object.defineProperties(self,{
      port: {enumerable: true, get:function(){return port;}},
      stop: {enumerable: true, value: function(){
         if(!stopped){
            l('[redis-server] STOPPING SERVER');
            stopped = true;
            
            if(proc.pid){
               proc.kill('SIGKILL');
            }
            
            if(path.exists(dmpFile)){
               try{ fs.unlinkSync(dmpFile); }
               catch(e){ l('[redis-server] !!! Could not remove '+dmpFile,e); }
            }
         }
      }}
   });

   ['exit','SIGINT','SIGKILL'].forEach(function(sig){
      process.on(sig,self.stop);
   });  
};

function createConfig(numdbs, dmpdir, dmpfile){
   return 'dbfilename '+dmpfile+'\n'+
          'dir '+dmpdir+'\n'+
          ((numdbs)?'databases '+numdbs:'');
}

module.exports = {
   createServer: function(cb, numdbs){
      exec('date +%N',function(e,o){
         const dmpfile = tmpdir + (new Number(o)).valueOf() +'_mockRediServer.dmp';
         numdbs = numdbs || 1;
         
         new MockServer(createConfig(numdbs,tmpdir,dmpfile),dmpfile,cb);
      });
   }
};

