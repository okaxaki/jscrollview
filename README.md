 # JScrollView

A Javascript ScrollView module with pan and pinch support. 
[Hammer.js](https://hammerjs.github.io/) is required. 

***This repository is still a personal experiment. No support, no bug-fixes.***
 
 # Quick Usage
 ```:html
<!DOCTYPE html>
<html>
<head>
	<meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1, maximum-scale=1">
	<script src="https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js"></script>
	<script src="dist/jscrollview.min.js"></script>
	<script>
		window.addEventListener('load', function(){	
			new JScrollView('container'); 
		});
	</script>
	<style>
*{margin:0;}
html,body{width:100%;height:100%;overflow:hidden;}
#container {width:100%;height:100%;background-color:#808080;}
#container img {width:100%;height:100%;pointer-events:none;}
	</style>
</head>
<body>
	<div id="container">
		<img src="./sample.jpg">
	</div>
</body>
</html>
```
The example above defines the content of the JScrollView directly in HTML source. If you would like to set the content by code, use `JScrollView#setContent(element)` instead.

# APIs

- [JScrollView Document](https://okaxaki.github.io/jscrollview/docs/)

# How to Build
```
git clone https://github.com/okaxaki/jscrollview.git
cd jscrollview
npm install
npm run build
```
