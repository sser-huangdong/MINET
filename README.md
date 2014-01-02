MINET
=====

Thanks to [Udi Talias](https://github.com/uditalias/chat-nodejs) for his demo.

---

更新
----
本来我也想高大上地用英文写这个文档的，不过想想还是算了。  
经过不懈努力终于成功把网站部署到OpenShift上了。

部署
----
在成功注册后，看看文档就可以大致知道怎么部署。  
不过有一点不同，我们本地测试的时候ip地址是127.0.0.1，端口是8080。  
但是在OpenShift上就要修改server.js:  
```javascrpit
var ipaddr  = process.env.OPENSHIFT_NODEJS_IP   || "127.0.0.1";
var port    = process.env.OPENSHIFT_NODEJS_PORT || 8080;
```
这是通过查看[样例](https://github.com/openshift-quickstart/nodejs-example?source=cc) 可以知道这个事实;  
还有官方文档里面有提到需要添加一些文件来告知服务器运行所需依赖。  
这个亲自行阅读网站文档，文件具体格式在样例中也有提及。


源代码修改
----------
源代码中还有一个地方需要修改：  
在public/scripts/chat.io.js里面,  
第11行的那个地址，请换成自己的网址！

自定义域名
---------
由于国内环境问题，所以OpenShift的网站是会给```qiang```的。  
只有使用自己的正常的域名才能在不翻墙的情况下访问。  
[参考教程](https://www.openshift.com/blogs/custom-url-names-for-your-paas-applications-host-forwarding-and-cnames-the-openshift-way)

TODO
----
https访问：考虑到速度问题就没有修改。
