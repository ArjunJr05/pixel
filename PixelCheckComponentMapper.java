import java.io.*;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.json.JSONArray;

/**
 * PixelCheck - Cross-Platform UI Component Mapper
 * Uses Zoho Catalyst QuickML LLM (Qwen 2.5 14B) to analyze and map
 * UI components across Android, iOS, and Web platforms
 */
public class PixelCheckComponentMapper {

    // QuickML LLM Configuration
    private static final String QUICKML_ENDPOINT = "https://api.catalyst.zoho.in/quickml/v2/project/28618000000011083/llm/chat";
    private static final String CATALYST_ORG = "60064252849";
    private static final String AUTHORIZATION_TOKEN = "Zoho-oauthtoken 1000.63bd483c2152e704e65f879f82596219.03e9481f8f677d8efbb6fafc6a6417b2";
    private static final String MODEL_NAME = "crm-di-qwen_text_14b-fp8-it";

    // Figma API Configuration
    private static final String FIGMA_API_BASE = "https://api.figma.com/v1";

    /**
     * Fetches Figma file JSON data
     */
    public static JSONObject fetchFigmaJSON(String fileKey, String accessToken) throws Exception {
        String url = FIGMA_API_BASE + "/files/" + fileKey;

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("X-Figma-Token", accessToken.trim())
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new Exception("Figma API error (" + response.statusCode() + "): " + response.body());
        }

        return new JSONObject(response.body());
    }

    /**
     * Analyzes Figma components using QuickML LLM
     */
    public static JSONObject analyzeFigmaComponents(JSONObject figmaJson, String platform) throws Exception {
        String prompt = String.format(
                "Analyze this Figma design JSON for %s platform and extract all UI components.\n\n" +
                        "Figma JSON:\n%s\n\n" +
                        "Please identify and list all interactive UI components with the following details:\n" +
                        "1. Component type (button, search_bar, search_icon, input_field, text_field, dropdown, checkbox, icon, etc.)\n"
                        +
                        "2. Component name/label\n" +
                        "3. Component purpose/function\n" +
                        "4. Text content (if any)\n" +
                        "5. Component ID from Figma\n\n" +
                        "Return the response in this exact JSON format:\n" +
                        "{\n" +
                        "  \"platform\": \"%s\",\n" +
                        "  \"components\": [\n" +
                        "    {\n" +
                        "      \"id\": \"figma_node_id\",\n" +
                        "      \"type\": \"component_type\",\n" +
                        "      \"name\": \"component_name\",\n" +
                        "      \"purpose\": \"what_it_does\",\n" +
                        "      \"text\": \"visible_text\",\n" +
                        "      \"properties\": {}\n" +
                        "    }\n" +
                        "  ]\n" +
                        "}",
                platform, figmaJson.toString(2), platform);

        String systemPrompt = "You are a UI/UX expert specializing in cross-platform design analysis. " +
                "You understand that the same functionality can be implemented differently across platforms: " +
                "Android often uses search bars, material design buttons; " +
                "iOS often uses search icons, native iOS controls; " +
                "Web uses standard HTML elements. " +
                "Be precise and extract all interactive components from the Figma JSON structure. " +
                "Always return valid JSON format.";

        return callQuickMLLLM(prompt, systemPrompt, 2000);
    }

    /**
     * Maps components across three platforms
     */
    public static JSONObject mapComponentsAcrossPlatforms(
            JSONObject androidComponents,
            JSONObject iosComponents,
            JSONObject webComponents) throws Exception {

        String prompt = String.format(
                "You are analyzing UI designs across three platforms: Android, iOS, and Web.\n\n" +
                        "ANDROID COMPONENTS:\n%s\n\n" +
                        "IOS COMPONENTS:\n%s\n\n" +
                        "WEB COMPONENTS:\n%s\n\n" +
                        "Task: Map equivalent components across all three platforms. Components serve the SAME PURPOSE even if they look different.\n\n"
                        +
                        "Examples of equivalent components:\n" +
                        "- Android \"Search Bar\" = iOS \"Search Icon\" = Web \"Search Input\"\n" +
                        "- Android \"Book Ticket Button\" = iOS \"Book Ticket Button\" = Web \"Submit Button\"\n" +
                        "- Android \"Date Picker\" = iOS \"Date Selector\" = Web \"Date Input\"\n\n" +
                        "Return the mapping in this exact JSON format:\n" +
                        "{\n" +
                        "  \"mappings\": [\n" +
                        "    {\n" +
                        "      \"purpose\": \"search_functionality\",\n" +
                        "      \"android\": {\n" +
                        "        \"id\": \"component_id\",\n" +
                        "        \"type\": \"search_bar\",\n" +
                        "        \"name\": \"Search flights...\",\n" +
                        "        \"implementation\": \"SearchBar component\"\n" +
                        "      },\n" +
                        "      \"ios\": {\n" +
                        "        \"id\": \"component_id\",\n" +
                        "        \"type\": \"search_icon\",\n" +
                        "        \"name\": \"Search\",\n" +
                        "        \"implementation\": \"Magnifying glass icon\"\n" +
                        "      },\n" +
                        "      \"web\": {\n" +
                        "        \"id\": \"component_id\",\n" +
                        "        \"type\": \"search_input\",\n" +
                        "        \"name\": \"Search\",\n" +
                        "        \"implementation\": \"Input field with search icon\"\n" +
                        "      },\n" +
                        "      \"consistency\": \"equivalent\",\n" +
                        "      \"notes\": \"Same search functionality, different UI patterns\"\n" +
                        "    }\n" +
                        "  ],\n" +
                        "  \"summary\": {\n" +
                        "    \"total_mappings\": 0,\n" +
                        "    \"consistent_components\": 0,\n" +
                        "    \"missing_on_platforms\": [],\n" +
                        "    \"inconsistencies\": []\n" +
                        "  }\n" +
                        "}",
                androidComponents.toString(2),
                iosComponents.toString(2),
                webComponents.toString(2));

        String systemPrompt = "You are an expert in cross-platform UI/UX design patterns. " +
                "You understand platform-specific design guidelines: " +
                "Material Design for Android, Human Interface Guidelines for iOS, Web accessibility standards. " +
                "Your task is to identify functionally equivalent components even when they have different visual implementations. "
                +
                "Focus on PURPOSE and FUNCTIONALITY, not just appearance. " +
                "Always return valid JSON.";

        return callQuickMLLLM(prompt, systemPrompt, 3000);
    }

    /**
     * Core function to call QuickML LLM API
     */
    private static JSONObject callQuickMLLLM(String prompt, String systemPrompt, int maxTokens) throws Exception {
        // Create request payload
        JSONObject payload = new JSONObject();
        payload.put("prompt", prompt);
        payload.put("model", MODEL_NAME);
        payload.put("system_prompt", systemPrompt);
        payload.put("top_p", 0.9);
        payload.put("top_k", 50);
        payload.put("best_of", 1);
        payload.put("temperature", 0.7);
        payload.put("max_tokens", maxTokens);

        // Create HTTP client
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(QUICKML_ENDPOINT))
                .header("Content-Type", "application/json")
                .header("Authorization", AUTHORIZATION_TOKEN)
                .header("CATALYST-ORG", CATALYST_ORG)
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                .build();

        // Send request
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new Exception("QuickML LLM API error (" + response.statusCode() + "): " + response.body());
        }

        // Parse response
        JSONObject responseJson = new JSONObject(response.body());

        // Extract the actual response text
        String responseText;
        if (responseJson.has("response")) {
            responseText = responseJson.getString("response");
        } else if (responseJson.has("choices")) {
            responseText = responseJson.getJSONArray("choices")
                    .getJSONObject(0)
                    .getJSONObject("message")
                    .getString("content");
        } else {
            throw new Exception("Unexpected response format from QuickML LLM");
        }

        // Try to parse the response as JSON
        try {
            // Extract JSON from the response text
            int jsonStart = responseText.indexOf("{");
            int jsonEnd = responseText.lastIndexOf("}") + 1;
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
                String jsonStr = responseText.substring(jsonStart, jsonEnd);
                return new JSONObject(jsonStr);
            }
        } catch (Exception e) {
            System.err.println("Warning: Could not parse LLM response as JSON");
        }

        // Return raw response wrapped in JSON
        JSONObject result = new JSONObject();
        result.put("rawResponse", responseText);
        result.put("error", "Could not parse JSON from LLM response");
        return result;
    }

    /**
     * Extracts Figma file key from URL
     */
    public static String extractFigmaFileKey(String figmaUrl) throws Exception {
        // Figma URL format: https://www.figma.com/file/{fileKey}/{fileName}
        // or: https://www.figma.com/design/{fileKey}/{fileName}
        String[] parts = figmaUrl.split("/");
        for (int i = 0; i < parts.length; i++) {
            if ((parts[i].equals("file") || parts[i].equals("design")) && i + 1 < parts.length) {
                return parts[i + 1];
            }
        }
        throw new Exception("Invalid Figma URL format");
    }

    /**
     * Complete workflow: Analyze and map components across platforms
     */
    public static JSONObject analyzeAndMapPlatforms(
            String androidUrl,
            String iosUrl,
            String webUrl,
            String figmaAccessToken) throws Exception {

        System.out.println("=== PixelCheck Component Mapper ===\n");

        // Step 1: Extract file keys
        System.out.println("Step 1: Extracting Figma file keys...");
        String androidKey = extractFigmaFileKey(androidUrl);
        String iosKey = extractFigmaFileKey(iosUrl);
        String webKey = extractFigmaFileKey(webUrl);
        System.out.println("✓ File keys extracted\n");

        // Step 2: Fetch Figma JSON data
        System.out.println("Step 2: Fetching Figma designs...");
        JSONObject androidData = fetchFigmaJSON(androidKey, figmaAccessToken);
        System.out.println("✓ Android design fetched");
        JSONObject iosData = fetchFigmaJSON(iosKey, figmaAccessToken);
        System.out.println("✓ iOS design fetched");
        JSONObject webData = fetchFigmaJSON(webKey, figmaAccessToken);
        System.out.println("✓ Web design fetched\n");

        // Step 3: Analyze each platform with LLM
        System.out.println("Step 3: Analyzing components with QuickML LLM...");
        JSONObject androidAnalysis = analyzeFigmaComponents(androidData, "Android");
        System.out.println("✓ Android components analyzed");
        JSONObject iosAnalysis = analyzeFigmaComponents(iosData, "iOS");
        System.out.println("✓ iOS components analyzed");
        JSONObject webAnalysis = analyzeFigmaComponents(webData, "Web");
        System.out.println("✓ Web components analyzed\n");

        // Step 4: Map components across platforms
        System.out.println("Step 4: Mapping components across platforms...");
        JSONObject mapping = mapComponentsAcrossPlatforms(androidAnalysis, iosAnalysis, webAnalysis);
        System.out.println("✓ Component mapping complete\n");

        // Create final result
        JSONObject result = new JSONObject();
        result.put("success", true);

        JSONObject platforms = new JSONObject();
        platforms.put("android", androidAnalysis);
        platforms.put("ios", iosAnalysis);
        platforms.put("web", webAnalysis);
        result.put("platforms", platforms);

        result.put("mapping", mapping);
        result.put("timestamp", java.time.Instant.now().toString());

        return result;
    }

    /**
     * Prints component mapping results in a readable format
     */
    public static void printResults(JSONObject results) {
        System.out.println("\n=== ANALYSIS RESULTS ===\n");

        if (!results.getBoolean("success")) {
            System.out.println("❌ Analysis failed: " + results.optString("error", "Unknown error"));
            return;
        }

        // Print summary
        JSONObject mapping = results.getJSONObject("mapping");
        if (mapping.has("mappings")) {
            JSONArray mappings = mapping.getJSONArray("mappings");
            System.out.println("📊 Summary:");
            System.out.println("   Total Mappings: " + mappings.length());

            if (mapping.has("summary")) {
                JSONObject summary = mapping.getJSONObject("summary");
                System.out.println("   Consistent Components: " + summary.optInt("consistent_components", 0));
                System.out.println("   Inconsistencies: " + summary.optJSONArray("inconsistencies").length());
            }
            System.out.println();

            // Print each mapping
            System.out.println("🔗 Component Mappings:\n");
            for (int i = 0; i < mappings.length(); i++) {
                JSONObject map = mappings.getJSONObject(i);
                System.out.println("   " + (i + 1) + ". " + map.getString("purpose").replace("_", " ").toUpperCase());

                if (map.has("android")) {
                    JSONObject android = map.getJSONObject("android");
                    System.out.println("      🤖 Android: " + android.optString("type", "missing") + " - "
                            + android.optString("name", "-"));
                }

                if (map.has("ios")) {
                    JSONObject ios = map.getJSONObject("ios");
                    System.out.println("      🍎 iOS: " + ios.optString("type", "missing") + " - "
                            + ios.optString("name", "-"));
                }

                if (map.has("web")) {
                    JSONObject web = map.getJSONObject("web");
                    System.out.println("      🌐 Web: " + web.optString("type", "missing") + " - "
                            + web.optString("name", "-"));
                }

                System.out.println("      Status: " + map.optString("consistency", "unknown"));
                if (map.has("notes")) {
                    System.out.println("      Notes: " + map.getString("notes"));
                }
                System.out.println();
            }
        }
    }

    /**
     * Main method for testing
     */
    public static void main(String[] args) {
        if (args.length < 4) {
            System.out.println("Usage: java PixelCheckComponentMapper <figma_token> <android_url> <ios_url> <web_url>");
            System.out.println("\nExample:");
            System.out.println(
                    "  java PixelCheckComponentMapper figd_xxx https://figma.com/file/abc/android https://figma.com/file/def/ios https://figma.com/file/ghi/web");
            return;
        }

        String figmaToken = args[0];
        String androidUrl = args[1];
        String iosUrl = args[2];
        String webUrl = args[3];

        try {
            JSONObject results = analyzeAndMapPlatforms(androidUrl, iosUrl, webUrl, figmaToken);
            printResults(results);

            // Optionally save to file
            try (FileWriter file = new FileWriter("pixelcheck_results.json")) {
                file.write(results.toString(2));
                System.out.println("✓ Results saved to pixelcheck_results.json");
            }

        } catch (Exception e) {
            System.err.println("❌ Error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
