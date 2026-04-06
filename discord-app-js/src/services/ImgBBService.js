/**
 * ImgBB API entegrasyonu.
 */

const API_KEY = import.meta.env.VITE_IMGBB_KEY;

/**
 * Dosyayı ImgBB'ye yükler.
 * @param {File} file - Yüklenecek dosya nesnesi
 * @returns {Promise<string>} - Yüklenen görselin doğrudan URL'si
 */
export const uploadImage = async (file) => {
  if (!API_KEY || API_KEY === "BURAYA_IMGBB_API_KEY_EKLEYIN") {
    throw new Error("ImgBB API Key eksik! Lütfen .env dosyasını kontrol edin.");
  }

  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      // data.data.url -> Sayfa URL'si olabilir, data.data.display_url veya data.data.url
      // Genelde 'url' doğrudan görsel linkidir.
      return data.data.url;
    } else {
      throw new Error(data.error?.message || "Görsel yüklenirken hata oluştu.");
    }
  } catch (error) {
    console.error("ImgBB upload error:", error);
    throw error;
  }
};

const ImgBBService = {
  uploadImage,
};

export default ImgBBService;
