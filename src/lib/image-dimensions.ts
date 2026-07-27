export interface ImageDimensions {
    width: number;
    height: number;
}

function readImageDimensionsFromDataUrl(dataUrl: string): Promise<ImageDimensions> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            resolve({
                width: image.naturalWidth || image.width,
                height: image.naturalHeight || image.height,
            });
        };
        image.onerror = () => {
            reject(new Error('Não foi possível ler a imagem selecionada.'));
        };
        image.src = dataUrl;
    });
}

export async function readImageDimensions(file: File): Promise<ImageDimensions> {
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(file);
            try {
                return {
                    width: bitmap.width,
                    height: bitmap.height,
                };
            }
            finally {
                bitmap.close();
            }
        }
        catch {
            // Alguns navegadores não decodificam todos os formatos via createImageBitmap.
            // O fallback abaixo usa data:, permitido pela CSP da aplicação.
        }
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : '';
            if (!dataUrl) {
                reject(new Error('Não foi possível ler a imagem selecionada.'));
                return;
            }
            void readImageDimensionsFromDataUrl(dataUrl).then(resolve, reject);
        };
        reader.onerror = () => {
            reject(new Error('Não foi possível ler a imagem selecionada.'));
        };
        reader.readAsDataURL(file);
    });
}
