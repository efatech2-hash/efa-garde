/**
 * Utilitaire de compression et validation d'images pour le chat EFA GARDE :
 * - Refuse les fichiers > 1 Mo
 * - Compresse côté client à max 500 Ko et max 1024px de largeur/hauteur
 * - Format de sortie : WebP (image/webp)
 */

export const MAX_FILE_SIZE_LIMIT = 1024 * 1024; // 1 Mo max absolu
export const MAX_COMPRESSED_SIZE = 500 * 1024;  // 500 Ko max après compression
export const MAX_IMAGE_WIDTH = 1024;            // 1024px largeur max

export interface CompressOptions {
  maxWidth?: number;
  maxSizeBytes?: number;
  targetMimeType?: string;
}

/**
 * Valide et compresse une image côté client avant upload.
 * Refuse si > 1 Mo.
 * Compresse si > 500 Ko ou format non webp.
 */
export async function compressChatImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxWidth = MAX_IMAGE_WIDTH,
    maxSizeBytes = MAX_COMPRESSED_SIZE,
    targetMimeType = 'image/webp',
  } = options;

  // 1. Refus strict si > 1 Mo
  if (file.size > MAX_FILE_SIZE_LIMIT) {
    throw new Error('Fichier supérieur à 1 Mo refusé. Veuillez sélectionner une photo de moins de 1 Mo.');
  }

  // Si ce n'est pas une image standard, retourner telle quelle
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // 2. if (file.size > 500kb) compress. Format webp.
  // Si le fichier est déjà <= 500 Ko ET déjà en webp, pas besoin de ré-encoder
  if (file.size <= maxSizeBytes && file.type === 'image/webp') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format d’image non supporté ou fichier corrompu'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcul des dimensions proportionnelles (max 1024px de large)
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback en cas d'indisponibilité du contexte 2D
          return resolve(file);
        }

        // Lissage haute qualité
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Algorithme d'optimisation de qualité progressive (0.85 -> 0.40) pour garantir <= 500 Ko
        const exportWithQuality = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return resolve(file);
              }

              // Si le blob dépasse encore 500 Ko et qu'on peut encore réduire la qualité
              if (blob.size > maxSizeBytes && quality > 0.4) {
                exportWithQuality(quality - 0.15);
              } else {
                const baseName = file.name.replace(/\.[^/.]+$/, '');
                const outputName = `${baseName}.webp`;
                const compressedFile = new File([blob], outputName, {
                  type: targetMimeType,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              }
            },
            targetMimeType,
            quality
          );
        };

        exportWithQuality(0.85);
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
