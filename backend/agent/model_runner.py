from transformers import pipeline

_PIPELINE = None
_PIPELINE_MODEL = None


def _get_pipeline(model_name: str):
    global _PIPELINE, _PIPELINE_MODEL
    if _PIPELINE is None or _PIPELINE_MODEL != model_name:
        _PIPELINE = pipeline("text2text-generation", model=model_name, device=-1)
        _PIPELINE_MODEL = model_name
    return _PIPELINE


def run_model(prompt: str, model_name: str, max_new_tokens: int = 240) -> str:
    generator = _get_pipeline(model_name)
    outputs = generator(
        prompt,
        do_sample=False,
        max_new_tokens=max_new_tokens,
        truncation=True,
    )
    return outputs[0]["generated_text"]
