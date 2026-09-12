import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import FloatingLabelInput from "../../../components/Input/FloatingLabelInput";
import FloatingLabelSelect from "../../../components/Select/FloatingLabelSelect";
import SubmitButton from "../../../components/Button/SubmitButton";
import GenderService from "../../../services/GenderService";
import { useAuth } from "../../../contexts/AuthContext";

const ResidentRegisterPage = () => {
    const [genders, setGenders] = useState<{ gender_id: number; gender: string }[]>([]);
    const [form, setForm] = useState({
        first_name: "", middle_name: "", last_name: "", gender: "", birth_date: "",
        contact_number: "", address: "", plate_number: "", car_model: "", car_color: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { residentRegister } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        GenderService.loadPublicGenders().then((r) => setGenders(r.data.genders ?? []));
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (form.contact_number.length !== 11) {
            setError("Contact number must be exactly 11 digits.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            await residentRegister({ ...form, gender: form.gender });
            navigate("/resident/home");
        } catch {
            setError("Registration failed. Check your details.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-blue-700 p-4 py-8">
            <div className="max-w-sm mx-auto bg-white rounded-2xl p-6">
                <h1 className="text-xl font-bold mb-4">Resident Registration</h1>
                {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto">
                    <FloatingLabelInput type="text" label="First Name" name="first_name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                    <FloatingLabelInput type="text" label="Middle Name" name="middle_name" value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} />
                    <FloatingLabelInput type="text" label="Last Name" name="last_name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                    <FloatingLabelSelect label="Gender" name="gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} required>
                        <option value="">Select</option>
                        {genders.map((g) => <option key={g.gender_id} value={g.gender_id}>{g.gender}</option>)}
                    </FloatingLabelSelect>
                    <FloatingLabelInput label="Birthdate" name="birth_date" type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} required />
                    <FloatingLabelInput type="text" label="Contact Number" name="contact_number" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value.replace(/\D/g, "").slice(0, 11) })} required maxLength={11} inputMode="numeric" pattern="[0-9]*" />
                    <FloatingLabelInput type="text" label="Address" name="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                    <FloatingLabelInput type="text" label="Plate Number" name="plate_number" value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} required />
                    <FloatingLabelInput type="text" label="Car Model" name="car_model" value={form.car_model} onChange={(e) => setForm({ ...form, car_model: e.target.value })} required />
                    <FloatingLabelInput type="text" label="Car Color" name="car_color" value={form.car_color} onChange={(e) => setForm({ ...form, car_color: e.target.value })} required />
                    <SubmitButton className="w-full" label="Register" loading={loading} />
                </form>
                <p className="text-center text-sm mt-4"><Link to="/resident/login" className="text-blue-600">Already registered? Sign in</Link></p>
            </div>
        </div>
    );
};

export default ResidentRegisterPage;
