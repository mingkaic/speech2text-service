{
	"targets": [
		{
			"target_name": "addon",
			"sources": [ "audio_s2t.cpp" ],
			"cflags": [ "-Wall", "-std=c++14", "-fexceptions" ],
			"cflags_cc": [ "-Wall", "-std=c++14", "-fexceptions" ],
			"cflags!": [ "-fno-exceptions" ],
			"cflags_cc!": [ "-fno-exceptions" ],
			"libraries": [],
			"include_dirs" : [
				"<!(node -e \"require('nan')\")", 
				"<!(node -e \"require('streaming-worker-sdk')\")"
			]
		}
	]
}
