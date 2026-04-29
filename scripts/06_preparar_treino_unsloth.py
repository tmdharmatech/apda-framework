import os
import json
import glob

def preparar_dataset():
    diretorio_saida = "saida"
    arquivo_final = "dataset_treino_apda.jsonl"
    
    # Prompt base seguindo o padrão Alpaca/Unsloth
    PROMPT_SISTEMA = "Você é um especialista em educação e IA. Sua tarefa é transformar textos pedagógicos anonimizados em arquivos JSON estruturados seguindo o schema APDA."
    
    dataset = []

    # Busca todos os textos anonimizados (recursivo)
    textos_anonimos = glob.glob(os.path.join(diretorio_saida, "**", "*.txt"), recursive=True)
    textos_anonimos = [f for f in textos_anonimos if "anonimizado" in f]
    
    print(f"Encontrados {len(textos_anonimos)} arquivos de texto anonimizado potenciais.")

    for caminho_texto in textos_anonimos:
        # Tenta achar o JSON correspondente
        diretorio = os.path.dirname(caminho_texto)
        nome_base = os.path.basename(caminho_texto).split(".")[0]
        
        # Procura por um arquivo JSON no mesmo diretorio
        arquivos_json = [f for f in glob.glob(os.path.join(diretorio, "*.json")) if nome_base in f and "metadata" not in f]
        
        if arquivos_json:
            # Usa o primeiro JSON encontrado como a "Resposta Ideal"
            caminho_json = arquivos_json[0]
            
            try:
                with open(caminho_texto, 'r', encoding='utf-8') as f:
                    texto_entrada = f.read().strip()
                
                with open(caminho_json, 'r', encoding='utf-8') as f:
                    # Carregamos e re-serializamos para garantir que o JSON esteja compacto/limpo
                    dados_json = json.load(f)
                    resposta_json = json.dumps(dados_json, ensure_ascii=False, indent=2)
                
                # Cria a estrutura para o Unsloth
                exemplo = {
                    "instruction": PROMPT_SISTEMA,
                    "input": texto_entrada,
                    "output": resposta_json
                }
                dataset.append(exemplo)
                print(f"✔ Par adicionado: {nome_base}")
                
            except Exception as e:
                print(f"✘ Erro ao processar {nome_base}: {e}")

    if dataset:
        with open(arquivo_final, 'w', encoding='utf-8') as f:
            for item in dataset:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        print(f"\n🚀 Sucesso! Dataset gerado com {len(dataset)} exemplos em: {arquivo_final}")
        print("Agora você pode subir este arquivo para o Google Colab para iniciar o Fine-tuning.")
    else:
        print("\n⚠ Nenhum par Texto/JSON correspondente foi encontrado para o treino.")

if __name__ == "__main__":
    preparar_dataset()
