#include <cassert>
#include <string>
#include <thread>

#include "streaming-worker.h"

class AudioStreamer : public StreamingWorker
{
public:
	AudioStreamer (
		Callback *data, 
		Callback *complete,
		Callback *error_callback, 
		v8::Local<v8::Object> & options) : 
	StreamingWorker(data, complete, error_callback)
	{
		if (options->IsObject())
		{
			v8::Local<v8::Value> filter_ = options->Get(New<v8::String>("filter").ToLocalChecked());
			if (filter_->IsString())
			{
				v8::String::Utf8Value s(filter_);
				filter = *s;
			}
		}
		assert("end" != filter);
	}
	
	~AudioStreamer (void) {}

	void Execute (const AsyncProgressWorker::ExecutionProgress& progress)
	{
		bool read = true;
		while (read)
		{
			Message m = fromNode.read();
			read = "end" != m.name;
			if (read && filter_by_name(m.name))
			{
				audiostr += m.data;
			}
		}

		// process audiostr

		this->writeToNode(progress, Message("concat", audiostr));
	}
	
private:
	bool filter_by_name (std::string name)
	{
		return (filter.empty() || name == filter);
	}

	std::string audiostr = "";
	std::string filter = "";
};

StreamingWorker* create_worker (
	Callback* data, Callback* complete, 
	Callback* error_callback, 
	v8::Local<v8::Object>& options)
{
	return new AudioStreamer(data, complete, error_callback, options);
}

NODE_MODULE(audio, StreamWorkerWrapper::Init)
